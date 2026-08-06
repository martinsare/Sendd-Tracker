import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { topicBreakdownFromItems, topTopicsFromItems } from "@/lib/analysis/topics";

const querySchema = z.object({
  page: z.coerce.number().int().min(0).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  kind: z.enum(["contributions", "votes"]).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = req.nextUrl;
  const parsed = querySchema.safeParse({
    page: searchParams.get("page"),
    pageSize: searchParams.get("pageSize"),
    kind: searchParams.get("kind"),
  });

  const page = parsed.success ? (parsed.data.page ?? 0) : 0;
  const pageSize = parsed.success ? (parsed.data.pageSize ?? 20) : 20;
  const kind = parsed.success ? parsed.data.kind : undefined;
  const offset = page * pageSize;

  const { rows: memberRows } = await query<{ name: string }>(
    `SELECT name FROM members WHERE id = $1`, [id]
  );
  if (!memberRows[0])
    return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const memberName = memberRows[0].name;

  const contributions = (!kind || kind === "contributions")
    ? await fetchContributions(id, pageSize, offset)
    : [];

  const votes = (!kind || kind === "votes")
    ? await fetchVotes(id, pageSize, offset)
    : [];

  const { rows: scCount } = await query<{ c: string }>(
    `SELECT COUNT(1) as c FROM spoken_contributions WHERE member_id = $1`, [id]
  );
  const { rows: mvCount } = await query<{ c: string }>(
    `SELECT COUNT(1) as c FROM member_votes WHERE member_id = $1`, [id]
  );

  const totalContributions = Number(scCount[0]?.c ?? 0);
  const totalVotes = Number(mvCount[0]?.c ?? 0);

  const allForTopics = await fetchAllSnippetsForTopics(id);
  const topTopics = topTopicsFromItems(allForTopics);
  const topicBreakdown = topicBreakdownFromItems(allForTopics);

  return NextResponse.json({
    memberId: id,
    memberName,
    totalContributions,
    totalVotes,
    topTopics,
    topicBreakdown,
    page,
    pageSize,
    contributions,
    votes,
  });
}

async function fetchContributions(memberId: string, limit: number, offset: number) {
  const { rows } = await query<{
    id: string;
    meetingid: number;
    contributionid: number;
    speakername: string;
    occurredat: string;
    contexten: string | null;
    contextcy: string | null;
    snippeten: string;
    snippetcy: string | null;
    sourceurl: string;
    confidence: string;
  }>(
    `SELECT id, meeting_id as meetingid, contribution_id as contributionid,
            speaker_name as speakername, occurred_at as occurredat,
            context_en as contexten, context_cy as contextcy,
            snippet_en as snippeten, snippet_cy as snippetcy,
            source_url as sourceurl, confidence
     FROM spoken_contributions
     WHERE member_id = $1
     ORDER BY occurred_at DESC, meeting_id DESC
     LIMIT $2 OFFSET $3`,
    [memberId, limit, offset]
  );

  return rows.map((r) => ({
    id: String(r.id),
    meetingId: r.meetingid,
    contributionId: r.contributionid,
    speakerName: r.speakername,
    occurredAt: r.occurredat,
    contextEn: r.contexten,
    contextCy: r.contextcy,
    snippetEn: r.snippeten,
    snippetCy: r.snippetcy,
    sourceUrl: r.sourceurl,
    confidence: r.confidence,
  }));
}

async function fetchVotes(memberId: string, limit: number, offset: number) {
  const { rows } = await query<{
    id: string;
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
    confidence: string;
  }>(
    `SELECT id, meeting_id as meetingid, contribution_id as contributionid,
            occurred_at as occurredat,
            vote_name_en as votenameen, vote_name_cy as votenamecw,
            vote_result_en as voteresulten, vote_result_cy as voteresultcy,
            totals_for as totalsfor, totals_against as totalsagainst, totals_abstain as totalsabstain,
            member_result as memberresult, source_url as sourceurl, confidence
     FROM member_votes
     WHERE member_id = $1
     ORDER BY occurred_at DESC, meeting_id DESC
     LIMIT $2 OFFSET $3`,
    [memberId, limit, offset]
  );

  return rows.map((r) => ({
    id: String(r.id),
    meetingId: r.meetingid,
    contributionId: r.contributionid,
    occurredAt: r.occurredat,
    voteNameEn: r.votenameen,
    voteNameCy: r.votenamecw,
    voteResultEn: r.voteresulten,
    voteResultCy: r.voteresultcy,
    totalsFor: r.totalsfor,
    totalsAgainst: r.totalsagainst,
    totalsAbstain: r.totalsabstain,
    memberResult: r.memberresult,
    sourceUrl: r.sourceurl,
    confidence: r.confidence,
  }));
}

async function fetchAllSnippetsForTopics(memberId: string) {
  const { rows } = await query<{ snippeten: string | null; snippetcy: string | null; contexten: string | null; contextcy: string | null }>(
    `SELECT snippet_en as snippeten, snippet_cy as snippetcy, context_en as contexten, context_cy as contextcy
     FROM spoken_contributions WHERE member_id = $1 LIMIT 200`,
    [memberId]
  );
  return rows.map((r) => ({
    snippetEn: r.snippeten ?? undefined,
    snippetCy: r.snippetcy ?? undefined,
    contextEn: r.contexten ?? undefined,
    contextCy: r.contextcy ?? undefined,
  }));
}
