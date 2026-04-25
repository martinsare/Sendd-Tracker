import type { Router } from "express";
import { z } from "zod";
import type { Db } from "../db.js";
import { indexRecentPlenarySpokenContributions } from "../extract/spokenContributions.js";
import { indexRecentPlenaryVotes } from "../extract/votes.js";
import { topTopicsFromItems, topicBreakdownFromItems } from "../analysis/topics.js";

const paramsSchema = z.object({ id: z.string().min(1).max(200) });

export function registerParticipationRoutes(router: Router, db: Db) {
  router.get("/members/:id/participation", (req, res) => {
    const parsed = paramsSchema.safeParse({ id: req.params.id });
    if (!parsed.success) return res.status(400).json({ error: "Invalid member id" });

    void handleParticipation(db, parsed.data.id)
      .then((payload) => res.json(payload))
      .catch((e: any) => {
        res.status(502).json({ error: "Participation extraction failed", detail: String(e?.message ?? e) });
      });
  });
}

async function handleParticipation(db: Db, memberId: string) {
  const dataNotes: string[] = [];
  const maxMeetings = 6;

  let speechItems = loadSpokenContributions(db, memberId);
  let voteItems = loadMemberVotes(db, memberId);

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

  const items = [...speechItems, ...voteItems].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

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
    summary
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

  return rows.map((r) => ({
    id: `spoken:${r.meetingId}:${r.contributionId}`,
    kind: "speech" as const,
    occurredAt: r.occurredAt,
    title: (r.contextEn ?? r.contextCy ?? "Plenary contribution").trim(),
    contextEn: r.contextEn ?? undefined,
    contextCy: r.contextCy ?? undefined,
    snippetEn: r.snippetEn,
    snippetCy: r.snippetCy ?? undefined,
    sourceUrl: r.sourceUrl,
    confidence: r.confidence
  }));
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

    const snippetEn = [`Member result: ${r.memberResult}.`, r.voteResultEn ? `Overall: ${r.voteResultEn}.` : "", totals]
      .filter(Boolean)
      .join(" ")
      .trim();

    // We do not translate official text. For Welsh, we only use the official Welsh outcome string if present.
    const snippetCy = [`Canlyniad yr Aelod: ${r.memberResult}.`, r.voteResultCy ? `Cyffredinol: ${r.voteResultCy}.` : "", totals]
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
      sourceUrl: r.sourceUrl,
      confidence: r.confidence
    };
  });
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
