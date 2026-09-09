import { NextRequest, NextResponse } from "next/server";
import { getConvexClient, isConvexConfigured } from "@/lib/db";
import { fetchSeneddDebates } from "@/lib/sources/twfy";
import {
  classifyTopicsFromText,
  primaryTopicFromText,
  topTopicsFromItems,
  topicBreakdownFromItems,
} from "@/lib/analysis/topics";
import { logServerSideError } from "@/lib/services/errorLog";


export const dynamic = "force-dynamic";

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

async function loadTwfyDebates(memberId: string) {
  const pid = memberId.replace(/^twfy:/, "");
  const rows = await fetchSeneddDebates({ personId: pid, num: 50 });

  return rows.map((r, idx) => {
    const rawBody = (r.body || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const title = (r.parent?.epheading || r.parent?.body || r.epheading || "Senedd Plenary Contribution")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const occurredAt = r.hdate ? `${r.hdate}${r.htime ? `T${r.htime}Z` : "T12:00:00Z"}` : new Date().toISOString();
    const snippetEn = rawBody.slice(0, 300) + (rawBody.length > 300 ? "…" : "");
    const topics = classifyTopicsFromText(`${title} ${rawBody}`);
    const primaryTopic = primaryTopicFromText(`${title} ${rawBody}`);
    const kind = inferSpeechKind(title, rawBody);
    const sourceUrl = r.listurl
      ? r.listurl.startsWith("http")
        ? r.listurl
        : `https://www.theyworkforyou.com${r.listurl}`
      : `https://www.theyworkforyou.com/senedd/?pid=${pid}`;

    return {
      id: `twfy:debate:${r.gid || idx}`,
      kind,
      occurredAt,
      title,
      contextEn: title,
      contextCy: undefined,
      snippetEn,
      snippetCy: undefined,
      topics,
      primaryTopic,
      sourceUrl,
      confidence: "high" as const,
    };
  });
}

async function loadSpokenContributions(memberId: string) {
  if (isConvexConfigured()) {
    try {
      const client = getConvexClient();
      if (client) {
        const rows = await (client as any).query("contributions:getByMember", { memberId, limit: 50 });
        if (Array.isArray(rows)) {
          return rows.map((r: any) => {
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
      }
    } catch {
      // Fallback
    }
  }
  return [];
}

async function loadMemberVotes(memberId: string) {
  if (isConvexConfigured()) {
    try {
      const client = getConvexClient();
      if (client) {
        const rows = await (client as any).query("votes:getByMember", { memberId, limit: 50 });
        if (Array.isArray(rows)) {
          return rows.map((r: any) => {
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
      }
    } catch {
      // Fallback
    }
  }
  return [];
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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rawId = (await params).id;
  const id = decodeURIComponent(rawId);

  try {
    const [twfyDebates, dbSpeeches, dbVotes] = await Promise.all([
      loadTwfyDebates(id).catch(() => []),
      loadSpokenContributions(id).catch(() => []),
      loadMemberVotes(id).catch(() => []),
    ]);

    // Merge TheyWorkForYou debates with any database extracted speeches (deduplicating by title/date)
    const seenTitles = new Set<string>();
    const allSpeeches = [];

    for (const item of [...twfyDebates, ...dbSpeeches]) {
      const key = `${item.title.toLowerCase()}_${item.occurredAt.slice(0, 10)}`;
      if (!seenTitles.has(key)) {
        seenTitles.add(key);
        allSpeeches.push(item);
      }
    }

    const items = [...allSpeeches, ...dbVotes].sort((a, b) =>
      b.occurredAt.localeCompare(a.occurredAt)
    );

    const dataNotes: string[] = ["theyworkforyou_api_live", "limited_to_recent_plenary_exports"];
    if (items.some((i) => i.confidence !== "high")) dataNotes.push("name_matching_uncertain");
    if (allSpeeches.length === 0) dataNotes.push("no_recent_contributions_found");

    const summary = buildSummary(allSpeeches);

    return NextResponse.json({
      memberId: id,
      lastUpdatedAt: new Date().toISOString(),
      real: {
        implemented: true,
        partial: true,
        items,
        dataNotes,
        topicClassificationNote:
          "Debates, speeches, and member contributions are retrieved via the TheyWorkForYou API.",
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
    const { errorRef, publicMessage } = await logServerSideError({
      endpoint: `/api/members/${id}/participation`,
      error: e,
      metadata: { memberId: id },
    });
    return NextResponse.json(
      { error: publicMessage, errorRef },
      { status: 502 }
    );
  }
}

