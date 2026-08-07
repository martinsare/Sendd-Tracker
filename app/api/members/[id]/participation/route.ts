import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
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
  const { data } = await supabase()
    .from("spoken_contributions")
    .select(
      "meeting_id,contribution_id,occurred_at,context_en,context_cy,snippet_en,snippet_cy,source_url,confidence",
    )
    .eq("member_id", memberId)
    .order("occurred_at", { ascending: false })
    .limit(50);

  return (data ?? []).map((r: any) => {
    const title = (r.context_en ?? r.context_cy ?? "Plenary contribution").trim();
    const contextEn = r.context_en ?? undefined;
    const contextCy = r.context_cy ?? undefined;
    const snippetEn = r.snippet_en;
    const snippetCy = r.snippet_cy ?? undefined;
    const topicText = [title, contextEn, contextCy, snippetEn, snippetCy].filter(Boolean).join(" ");
    const topics = classifyTopicsFromText(topicText);
    const primaryTopic = primaryTopicFromText(topicText);
    const kind = inferSpeechKind(title, contextEn);

    return {
      id: `spoken:${r.meeting_id}:${r.contribution_id}`,
      kind,
      occurredAt: r.occurred_at,
      title,
      contextEn,
      contextCy,
      snippetEn,
      snippetCy,
      topics,
      primaryTopic,
      sourceUrl: r.source_url,
      confidence: r.confidence,
    };
  });
}

async function loadMemberVotes(memberId: string) {
  const { data } = await supabase()
    .from("member_votes")
    .select(
      "meeting_id,contribution_id,occurred_at,vote_name_en,vote_name_cy,vote_result_en,vote_result_cy,totals_for,totals_against,totals_abstain,member_result,source_url,confidence",
    )
    .eq("member_id", memberId)
    .order("occurred_at", { ascending: false })
    .limit(50);

  return (data ?? []).map((r: any) => {
    const totals =
      r.totals_for != null && r.totals_against != null && r.totals_abstain != null
        ? `Totals: For ${r.totals_for}, Against ${r.totals_against}, Abstain ${r.totals_abstain}.`
        : "";

    const snippetEn = [
      `Member result: ${r.member_result || "Unknown"}.`,
      r.vote_result_en ? `Overall: ${r.vote_result_en}.` : "",
      totals,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    const snippetCy = [
      `Canlyniad yr Aelod: ${r.member_result || "Anhysbys"}.`,
      r.vote_result_cy ? `Cyffredinol: ${r.vote_result_cy}.` : "",
      totals,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    return {
      id: `vote:${r.meeting_id}:${r.contribution_id}`,
      kind: "vote" as const,
      occurredAt: r.occurred_at,
      title: (r.vote_name_en ?? r.vote_name_cy ?? "Vote").trim(),
      contextEn: r.vote_name_en ?? undefined,
      contextCy: r.vote_name_cy ?? undefined,
      snippetEn,
      snippetCy: snippetCy || undefined,
      vote: {
        memberResult: normalizeVoteMemberResult(r.member_result),
        memberResultRaw: r.member_result,
        overallEn: r.vote_result_en ?? null,
        overallCy: r.vote_result_cy ?? null,
        totals:
          r.totals_for != null && r.totals_against != null && r.totals_abstain != null
            ? { for: r.totals_for, against: r.totals_against, abstain: r.totals_abstain }
            : null,
      },
      sourceUrl: r.source_url,
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
  const results = await Promise.all([
    supabase().from("members").select("updated_at,last_updated_at").order("updated_at", { ascending: false }).limit(1),
    supabase().from("spoken_contributions").select("extracted_at,last_updated_at").order("extracted_at", { ascending: false }).limit(1),
    supabase().from("member_votes").select("extracted_at,last_updated_at").order("extracted_at", { ascending: false }).limit(1),
  ]);

  let max = 0;
  for (const res of results) {
    const row = res.data?.[0] as any;
    const v = row?.last_updated_at ?? row?.updated_at ?? row?.extracted_at;
    if (v) max = Math.max(max, Number(v));
  }
  return max ? new Date(max).toISOString() : null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rawId = (await params).id;
  const id = decodeURIComponent(rawId);

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
