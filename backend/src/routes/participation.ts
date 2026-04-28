import type { Router } from "express";
import { z } from "zod";
import type { Db } from "../db.js";
import { indexRecentPlenarySpokenContributions } from "../extract/spokenContributions.js";
import { indexRecentPlenaryVotes } from "../extract/votes.js";
import { classifyTopicsFromText, primaryTopicFromText, topTopicsFromItems, topicBreakdownFromItems } from "../analysis/topics.js";
import { getMeetingDetail, listCommittees, listMeetingsByDate, mgDateString, parseMgDateToIso } from "../sources/meetingInfo.js";
import type { MeetingSummary } from "../sources/meetingInfo.js";

const paramsSchema = z.object({ id: z.string().min(1).max(200) });
const querySchema = z.object({
  maxMeetings: z.coerce.number().int().min(1).max(80).optional(),
  committeeDaysBack: z.coerce.number().int().min(7).max(365).optional(),
  maxCommitteeMeetings: z.coerce.number().int().min(0).max(60).optional(),
});

export function registerParticipationRoutes(router: Router, db: Db) {
  router.get("/members/:id/participation", (req, res) => {
    const parsed = paramsSchema.safeParse({ id: req.params.id });
    if (!parsed.success) return res.status(400).json({ error: "Invalid member id" });

    const q = querySchema.safeParse(req.query);
    if (!q.success) return res.status(400).json({ error: "Invalid query params" });

    void handleParticipation(db, parsed.data.id, {
      maxMeetings: q.data.maxMeetings,
      committeeDaysBack: q.data.committeeDaysBack,
      maxCommitteeMeetings: q.data.maxCommitteeMeetings,
    })
      .then((payload) => res.json(payload))
      .catch((e: any) => {
        res.status(502).json({ error: "Participation extraction failed", detail: String(e?.message ?? e) });
      });
  });
}

const DEFAULT_MAX_PLENARY_MEETINGS = 20;
const DEFAULT_COMMITTEE_DAYS_BACK = 120;
const DEFAULT_MAX_COMMITTEE_MEETINGS = 18;

async function handleParticipation(db: Db, memberId: string, opts?: { maxMeetings?: number; committeeDaysBack?: number; maxCommitteeMeetings?: number }) {
  const dataNotes: string[] = [];
  const maxMeetings = opts?.maxMeetings ?? DEFAULT_MAX_PLENARY_MEETINGS;

  let speechItems = loadSpokenContributions(db, memberId);
  let voteItems = loadMemberVotes(db, memberId);

  const committeeDaysBack = opts?.committeeDaysBack ?? DEFAULT_COMMITTEE_DAYS_BACK;
  const maxCommitteeMeetings = opts?.maxCommitteeMeetings ?? DEFAULT_MAX_COMMITTEE_MEETINGS;

  const shouldRefreshSpeech = speechItems.length === 0 || isSpeechExtractionStale(db, memberId);
  const shouldRefreshVotes = voteItems.length === 0 || isVoteExtractionStale(db, memberId);

  if (shouldRefreshSpeech || shouldRefreshVotes) {
    let anyParsed = false;

    if (shouldRefreshSpeech) {
      try {
        const indexed = await indexRecentPlenarySpokenContributions(db, { maxMeetings });
        anyParsed = anyParsed || indexed.meetings.some((m) => m.parsed);
      } catch {
        // handled via data notes
      }
    }

    if (shouldRefreshVotes) {
      try {
        const indexedVotes = await indexRecentPlenaryVotes(db, { maxMeetings });
        anyParsed = anyParsed || indexedVotes.meetings.some((m) => m.parsed);
      } catch {
        // handled via data notes
      }
    }

    if (!anyParsed) dataNotes.push("upstream_or_parse_issue");
    speechItems = loadSpokenContributions(db, memberId);
    voteItems = loadMemberVotes(db, memberId);
    dataNotes.push("limited_to_recent_plenary_exports");
  } else {
    dataNotes.push("limited_to_recent_plenary_exports");
  }

  let committeeItems: any[] = [];
  if (maxCommitteeMeetings > 0) {
    try {
      committeeItems = await loadCommitteeMeetings(db, memberId, { daysBack: committeeDaysBack, limit: maxCommitteeMeetings });
    } catch {
      // Committee data is best-effort and should not break the participation endpoint if the Senedd endpoint is down.
      dataNotes.push("committee_data_unavailable");
      committeeItems = [];
    }
  }

  const items = [...speechItems, ...voteItems, ...committeeItems].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  const hasUncertain = items.some((i) => i.confidence !== "high");
  if (hasUncertain) dataNotes.push("name_matching_uncertain");
  if (speechItems.length === 0) dataNotes.push("no_recent_contributions_found");

  const summary = buildSummary(speechItems);

  return {
    memberId,
    lastUpdatedAt: computeLastUpdatedAt(db),
    real: {
      implemented: true,
      partial: true,
      items,
      dataNotes,
      topicClassificationNote:
        "Topic classification is based on keyword matching and may not fully reflect intent."
    },
    summary,
    committees: {
      implemented: true,
      partial: true,
      daysBack: committeeDaysBack,
      totalMeetingsFound: committeeItems.length
    }
  };
}

function isSpeechExtractionStale(db: Db, memberId: string) {
  const row = db
    .prepare(`SELECT MAX(extracted_at) as lastExtractedAt FROM spoken_contributions WHERE member_id = ?`)
    .get(memberId) as { lastExtractedAt: number | null } | undefined;
  if (!row?.lastExtractedAt) return true;
  const oneDay = 24 * 60 * 60 * 1000;
  return Date.now() - row.lastExtractedAt > oneDay;
}

function isVoteExtractionStale(db: Db, memberId: string) {
  const row = db
    .prepare(`SELECT MAX(extracted_at) as lastExtractedAt FROM member_votes WHERE member_id = ?`)
    .get(memberId) as { lastExtractedAt: number | null } | undefined;
  if (!row?.lastExtractedAt) return true;
  const oneDay = 24 * 60 * 60 * 1000;
  return Date.now() - row.lastExtractedAt > oneDay;
}

function loadSpokenContributions(db: Db, memberId: string) {
  const rows = db
    .prepare(
      `SELECT
         meeting_id as meetingId,
         contribution_id as contributionId,
         occurred_at as occurredAt,
         context_en as contextEn,
         context_cy as contextCy,
         snippet_en as snippetEn,
         snippet_cy as snippetCy,
         source_url as sourceUrl,
         confidence
       FROM spoken_contributions
       WHERE member_id = ?
       ORDER BY occurred_at DESC, meeting_id DESC, contribution_id DESC
       LIMIT 50`,
    )
    .all(memberId) as Array<{
    meetingId: number;
    contributionId: number;
    occurredAt: string;
    contextEn: string | null;
    contextCy: string | null;
    snippetEn: string;
    snippetCy: string | null;
    sourceUrl: string;
    confidence: "high" | "medium" | "low";
  }>;

  return rows.map((r) => {
    const title = (r.contextEn ?? r.contextCy ?? "Plenary contribution").trim();
    const contextEn = r.contextEn ?? undefined;
    const contextCy = r.contextCy ?? undefined;
    const snippetEn = r.snippetEn;
    const snippetCy = r.snippetCy ?? undefined;
    const topicText = [title, contextEn, contextCy, snippetEn, snippetCy].filter(Boolean).join(" ");
    const topics = classifyTopicsFromText(topicText);
    const primaryTopic = primaryTopicFromText(topicText);
    const kind = inferSpeechKind(title, contextEn, contextCy);

    return {
      id: `spoken:${r.meetingId}:${r.contributionId}`,
      kind,
      occurredAt: r.occurredAt,
      title,
      contextEn,
      contextCy,
      snippetEn,
      snippetCy,
      topics,
      primaryTopic,
      sourceUrl: r.sourceUrl,
      confidence: r.confidence
    };
  });
}

function inferSpeechKind(title: string, contextEn?: string, contextCy?: string): "speech" | "question" | "motion" {
  const t = `${title} ${contextEn ?? ""} ${contextCy ?? ""}`.toLowerCase();
  // Conservative: only label when official headings clearly indicate questions/motions.
  if (/\bquestions\b/.test(t) || /\bcwestiynau\b/.test(t)) return "question";
  if (/\bmotion\b/.test(t) || /\bcynnig\b/.test(t)) return "motion";
  return "speech";
}

async function loadCommitteeMeetings(db: Db, memberId: string, args: { daysBack: number; limit: number }) {
  const member = db
    .prepare(`SELECT senedd_uid as seneddUid, name FROM members WHERE id = ?`)
    .get(memberId) as { seneddUid: number | null; name: string } | undefined;
  if (!member?.seneddUid) return [];

  const now = new Date();
  const from = new Date(now.getTime() - args.daysBack * 24 * 60 * 60 * 1000);
  const fromStr = mgDateString(from);
  const toStr = mgDateString(now);

  const committeesRes = await listCommittees(db);
  const sixthCommittees = committeesRes.committees.filter(
    (c) => c.committeeCategory === "Committees" && / - Sixth Senedd$/i.test(c.committeeTitle),
  );

  const meetingSummaries: Array<MeetingSummary & { committeeTitleFallback: string }> = [];
  for (const c of sixthCommittees) {
    try {
      const res = await listMeetingsByDate(db, { committeeId: c.committeeId, fromDate: fromStr, toDate: toStr, ascending: false });
      for (const m of res.meetings) meetingSummaries.push({ ...m, committeeTitleFallback: c.committeeTitle });
    } catch {
      // best-effort
    }
  }

  const sorted = meetingSummaries
    .map((m) => ({ ...m, occurredAt: parseMgDateToIso(m.meetingDate) }))
    .filter((m) => !!m.occurredAt)
    .sort((a, b) => (b.occurredAt ?? "").localeCompare(a.occurredAt ?? ""));

  const out: any[] = [];
  let checked = 0;
  const maxChecks = Math.max(args.limit * 3, 30);

  for (const m of sorted) {
    if (out.length >= args.limit) break;
    if (checked >= maxChecks) break;
    checked++;

    try {
      const detail = await getMeetingDetail(db, m.meetingId);
      const attendee = detail.meeting.attendees.find((a) => a.memberId === member.seneddUid);
      if (!attendee) continue;

      const attendance = attendee.attendance ?? "Unknown";
      const committeeTitle = (m.committeeTitle ?? m.committeeTitleFallback).replace(/ - Sixth Senedd$/i, "").trim();

      out.push({
        id: `committee:${m.meetingId}:${member.seneddUid}`,
        kind: "committee" as const,
        occurredAt: m.occurredAt,
        title: committeeTitle || "Committee meeting",
        contextEn: committeeTitle || undefined,
        snippetEn: `Attendance: ${attendance}.`,
        snippetCy: `Presenoldeb: ${attendance}.`,
        sourceUrl: `https://business.senedd.wales/mgMeetingAttendance.aspx?ID=${m.meetingId}`,
        confidence: "high" as const,
        committee: {
          committeeId: m.committeeId ?? null,
          committeeTitle: committeeTitle || null,
          attendance,
          meetingLocation: detail.meeting.meetingLocation,
          isWebcast: detail.meeting.isWebcast,
        }
      });
    } catch {
      // best-effort
    }
  }

  return out;
}

function voteMemberResultLabelEn(raw: string) {
  const s = (raw ?? "").trim();
  if (!s) return "Unknown";
  if (/^didnotvote$/i.test(s) || /^did\s+not\s+vote$/i.test(s)) return "Did not vote";
  return s;
}

function voteMemberResultLabelCy(raw: string) {
  const s = (raw ?? "").trim();
  if (!s) return "Anhysbys";
  if (/^didnotvote$/i.test(s) || /^did\s+not\s+vote$/i.test(s)) return "Heb bleidleisio";
  // Keep raw for anything else; we do not translate official free text.
  return s;
}

function loadMemberVotes(db: Db, memberId: string) {
  const rows = db
    .prepare(
      `SELECT
         meeting_id as meetingId,
         contribution_id as contributionId,
         occurred_at as occurredAt,
         vote_name_en as voteNameEn,
         vote_name_cy as voteNameCy,
         vote_result_en as voteResultEn,
         vote_result_cy as voteResultCy,
         totals_for as totalsFor,
         totals_against as totalsAgainst,
         totals_abstain as totalsAbstain,
         member_result as memberResult,
         source_url as sourceUrl,
         confidence
       FROM member_votes
       WHERE member_id = ?
       ORDER BY occurred_at DESC, meeting_id DESC, contribution_id DESC
       LIMIT 50`,
    )
    .all(memberId) as Array<{
    meetingId: number;
    contributionId: number;
    occurredAt: string;
    voteNameEn: string | null;
    voteNameCy: string | null;
    voteResultEn: string | null;
    voteResultCy: string | null;
    totalsFor: number | null;
    totalsAgainst: number | null;
    totalsAbstain: number | null;
    memberResult: string;
    sourceUrl: string;
    confidence: "high" | "medium" | "low";
  }>;

  return rows.map((r) => {
    const totals =
      r.totalsFor != null && r.totalsAgainst != null && r.totalsAbstain != null
        ? `Totals: For ${r.totalsFor}, Against ${r.totalsAgainst}, Abstain ${r.totalsAbstain}.`
        : "";

    const snippetEn = [`Member result: ${voteMemberResultLabelEn(r.memberResult)}.`, r.voteResultEn ? `Overall: ${r.voteResultEn}.` : "", totals]
      .filter(Boolean)
      .join(" ")
      .trim();

    // We do not translate official text. For Welsh, we only use the official Welsh outcome string if present.
    const snippetCy = [`Canlyniad yr Aelod: ${voteMemberResultLabelCy(r.memberResult)}.`, r.voteResultCy ? `Cyffredinol: ${r.voteResultCy}.` : "", totals]
      .filter(Boolean)
      .join(" ")
      .trim();

    return {
      id: `vote:${r.meetingId}:${r.contributionId}`,
      kind: "vote" as const,
      occurredAt: r.occurredAt,
      title: (r.voteNameEn ?? r.voteNameCy ?? "Vote").trim(),
      contextEn: r.voteNameEn ?? undefined,
      contextCy: r.voteNameCy ?? undefined,
      snippetEn,
      snippetCy: snippetCy || undefined,
      vote: {
        memberResult: normalizeVoteMemberResult(r.memberResult),
        memberResultRaw: r.memberResult,
        overallEn: r.voteResultEn ?? null,
        overallCy: r.voteResultCy ?? null,
        totals:
          r.totalsFor != null && r.totalsAgainst != null && r.totalsAbstain != null
            ? { for: r.totalsFor, against: r.totalsAgainst, abstain: r.totalsAbstain }
            : null,
      },
      sourceUrl: r.sourceUrl,
      confidence: r.confidence
    };
  });
}

function normalizeVoteMemberResult(input: string): "for" | "against" | "abstain" | "did_not_vote" | null {
  const s = (input ?? "").trim().toLowerCase();
  if (!s) return null;
  if (s === "for" || s === "in favour" || s === "in favor") return "for";
  if (s === "against") return "against";
  if (s === "abstain" || s === "abstained") return "abstain";
  if (s === "didnotvote" || s === "did not vote") return "did_not_vote";
  return null;
}

function buildSummary(items: Array<{ occurredAt: string; title?: string; snippetEn?: string; snippetCy?: string; contextEn?: string; contextCy?: string }>) {
  const totalContributions = items.length;

  const now = new Date();
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const contributionsLast30Days = items.filter((i) => {
    const d = new Date(i.occurredAt);
    return Number.isFinite(d.getTime()) && d >= since;
  }).length;

  const monthCounts = new Map<string, number>();
  for (const it of items) {
    const d = new Date(it.occurredAt);
    if (!Number.isFinite(d.getTime())) continue;
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  }
  const mostActiveMonth = [...monthCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

  const topTopics = topTopicsFromItems(items, 3);
  const topicBreakdown = topicBreakdownFromItems(items);

  const activityLevel = totalContributions < 10 ? "Low" : totalContributions <= 50 ? "Moderate" : "High";

  return {
    totalContributions,
    contributionsLast30Days,
    mostActiveMonth,
    topTopics,
    topicBreakdown,
    activityLevel
  };
}

function computeLastUpdatedAt(db: Db) {
  const rows = [
    db.prepare(`SELECT MAX(COALESCE(last_updated_at, updated_at)) as v FROM members`).get() as { v: number | null },
    db.prepare(`SELECT MAX(COALESCE(last_updated_at, parsed_at, fetched_at)) as v FROM plenary_transcripts`).get() as { v: number | null },
    db.prepare(`SELECT MAX(COALESCE(last_updated_at, parsed_at, fetched_at)) as v FROM plenary_votes`).get() as { v: number | null },
    db.prepare(`SELECT MAX(COALESCE(last_updated_at, extracted_at)) as v FROM spoken_contributions`).get() as { v: number | null },
    db.prepare(`SELECT MAX(COALESCE(last_updated_at, extracted_at)) as v FROM member_votes`).get() as { v: number | null }
  ];
  const max = Math.max(...rows.map((r) => r.v ?? 0));
  return max ? new Date(max).toISOString() : null;
}
