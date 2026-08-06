import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  classifyTopicsFromText,
  primaryTopicFromText,
  topTopicsFromItems,
  topicBreakdownFromItems,
} from "@/lib/analysis/topics";

function inferSpeechKind(title: string, contextEn?: string): "speech" | "question" | "motion" {
  const t = `${title} ${contextEn ?? ""}`.toLowerCase();
  if (/\b(question|cwestiwn|oral question|written question)\b/.test(t)) return "question";
  if (/\b(motion|cynnig|debate)\b/.test(t)) return "motion";
  return "speech";
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

async function loadSpokenContributions(memberId: string) {
  const { rows } = await query<{
    meetingid: number;
    contributionid: number;
    occurredat: string;
    contexten: string | null;
    contextcy: string | null;
    snippeten: string;
    snippetcy: string | null;
    sourceurl: string;
    confidence: "high" | "medium" | "low";
  }>(
    `SELECT meeting_id as meetingid, contribution_id as contributionid,
            occurred_at as occurredat, context_en as contexten, context_cy as contextcy,
            snippet_en as snippeten, snippet_cy as snippetcy,
            source_url as sourceurl, confidence
     FROM spoken_contributions
     WHERE member_id = $1
     ORDER BY occurred_at DESC, meeting_id DESC, contribution_id DESC
     LIMIT 50`,
    [memberId]
  );

  return rows.map((r) => {
    const title = (r.contexten ?? r.contextcy ?? "Plenary contribution").trim();
    const contextEn = r.contexten ?? undefined;
    const contextCy = r.contextcy ?? undefined;
    const snippetEn = r.snippeten;
    const snippetCy = r.snippetcy ?? undefined;
    const topicText = [title, contextEn, contextCy, snippetEn, snippetCy].filter(Boolean).join(" ");
    const topics = classifyTopicsFromText(topicText);
    const primaryTopic = primaryTopicFromText(topicText);
    const kind = inferSpeechKind(title, contextEn);

    return {
      id: `spoken:${r.meetingid}:${r.contributionid}`,
      kind,
      occurredAt: r.occurredat,
      title,
      contextEn,
      contextCy,
      snippetEn,
      snippetCy,
      topics,
      primaryTopic,
      sourceUrl: r.sourceurl,
      confidence: r.confidence,
    };
  });
}

async function loadMemberVotes(memberId: string) {
  const { rows } = await query<{
    meetingid: number;
    contributionid: number;
    occurredat: string;
    votenameen: string | null;
    votenamecw: string | null;
    voteresulten: string | null;
    voteresultcy: string | null;
    totalsfor: number | null;
    totalsagainst: number | null;
    totalsabstain: number | null;
    memberresult: string;
    sourceurl: string;
    confidence: "high" | "medium" | "low";
  }>(
    `SELECT meeting_id as meetingid, contribution_id as contributionid,
            occurred_at as occurredat,
            vote_name_en as votenameen, vote_name_cy as votenamecw,
            vote_result_en as voteresulten, vote_result_cy as voteresultcy,
            totals_for as totalsfor, totals_against as totalsagainst, totals_abstain as totalsabstain,
            member_result as memberresult, source_url as sourceurl, confidence
     FROM member_votes
     WHERE member_id = $1
     ORDER BY occurred_at DESC, meeting_id DESC, contribution_id DESC
     LIMIT 50`,
    [memberId]
  );

  return rows.map((r) => {
    const totals =
      r.totalsfor != null && r.totalsagainst != null && r.totalsabstain != null
        ? `Totals: For ${r.totalsfor}, Against ${r.totalsagainst}, Abstain ${r.totalsabstain}.`
        : "";

    const snippetEn = [
      `Member result: ${r.memberresult || "Unknown"}.`,
      r.voteresulten ? `Overall: ${r.voteresulten}.` : "",
      totals,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    const snippetCy = [
      `Canlyniad yr Aelod: ${r.memberresult || "Anhysbys"}.`,
      r.voteresultcy ? `Cyffredinol: ${r.voteresultcy}.` : "",
      totals,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    return {
      id: `vote:${r.meetingid}:${r.contributionid}`,
      kind: "vote" as const,
      occurredAt: r.occurredat,
      title: (r.votenameen ?? r.votenamecw ?? "Vote").trim(),
      contextEn: r.votenameen ?? undefined,
      contextCy: r.votenamecw ?? undefined,
      snippetEn,
      snippetCy: snippetCy || undefined,
      vote: {
        memberResult: normalizeVoteMemberResult(r.memberresult),
        memberResultRaw: r.memberresult,
        overallEn: r.voteresulten ?? null,
        overallCy: r.voteresultcy ?? null,
        totals:
          r.totalsfor != null && r.totalsagainst != null && r.totalsabstain != null
            ? { for: r.totalsfor, against: r.totalsagainst, abstain: r.totalsabstain }
            : null,
      },
      sourceUrl: r.sourceurl,
      confidence: r.confidence,
    };
  });
}

function buildSummary(speechItems: Array<{ occurredAt: string; title?: string; snippetEn?: string; snippetCy?: string; contextEn?: string; contextCy?: string }>) {
  const totalContributions = speechItems.length;
  const now = new Date();
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const contributionsLast30Days = speechItems.filter((i) => {
    const d = new Date(i.occurredAt);
    return Number.isFinite(d.getTime()) && d >= since;
  }).length;

  const monthCounts = new Map<string, number>();
  for (const it of speechItems) {
    const d = new Date(it.occurredAt);
    if (!Number.isFinite(d.getTime())) continue;
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  }
  const mostActiveMonth = [...monthCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

  const topTopics = topTopicsFromItems(speechItems, 3);
  const topicBreakdown = topicBreakdownFromItems(speechItems);
  const activityLevel = totalContributions < 10 ? "Low" : totalContributions <= 50 ? "Moderate" : "High";

  return { totalContributions, contributionsLast30Days, mostActiveMonth, topTopics, topicBreakdown, activityLevel };
}

async function computeLastUpdatedAt(): Promise<string | null> {
  const results = await Promise.allSettled([
    query<{ v: string | null }>(`SELECT MAX(COALESCE(last_updated_at, updated_at)) as v FROM members`),
    query<{ v: string | null }>(`SELECT MAX(COALESCE(last_updated_at, extracted_at)) as v FROM spoken_contributions`),
    query<{ v: string | null }>(`SELECT MAX(COALESCE(last_updated_at, extracted_at)) as v FROM member_votes`),
  ]);

  let max = 0;
  for (const r of results) {
    if (r.status === "fulfilled") {
      const v = r.value.rows[0]?.v;
      if (v) max = Math.max(max, Number(v));
    }
  }
  return max ? new Date(max).toISOString() : null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const [speechItems, voteItems, lastUpdatedAt] = await Promise.all([
      loadSpokenContributions(id),
      loadMemberVotes(id),
      computeLastUpdatedAt(),
    ]);

    const items = [...speechItems, ...voteItems].sort((a, b) =>
      b.occurredAt.localeCompare(a.occurredAt)
    );

    const dataNotes: string[] = ["limited_to_recent_plenary_exports"];
    if (items.some((i) => i.confidence !== "high")) dataNotes.push("name_matching_uncertain");
    if (speechItems.length === 0) dataNotes.push("no_recent_contributions_found");

    const summary = buildSummary(speechItems);

    return NextResponse.json({
      memberId: id,
      lastUpdatedAt,
      real: {
        implemented: true,
        partial: true,
        items,
        dataNotes,
        topicClassificationNote:
          "Topic classification is based on keyword matching and may not fully reflect intent.",
      },
      summary: {
        ...summary,
        activityLevel: summary.activityLevel as "Low" | "Moderate" | "High",
      },
      committees: {
        implemented: false,
        partial: true,
        daysBack: 0,
        totalMeetingsFound: 0,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: "Participation load failed", detail: String((e as Error)?.message ?? e) },
      { status: 502 }
    );
  }
}
