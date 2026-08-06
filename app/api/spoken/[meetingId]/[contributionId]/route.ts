import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ meetingId: string; contributionId: string }> }
) {
  const { meetingId, contributionId } = await params;
  const mId = parseInt(meetingId, 10);
  const cId = parseInt(contributionId, 10);

  if (!Number.isFinite(mId) || !Number.isFinite(cId))
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const { rows } = await query<{
    id: string;
    memberId: string;
    speakername: string;
    occurredat: string;
    contexten: string | null;
    contextcy: string | null;
    snippeten: string;
    snippetcy: string | null;
    fulltexten: string | null;
    fulltextcy: string | null;
    sourceurl: string;
    confidence: string;
  }>(
    `SELECT id, member_id as "memberId", speaker_name as speakername, occurred_at as occurredat,
            context_en as contexten, context_cy as contextcy,
            snippet_en as snippeten, snippet_cy as snippetcy,
            full_text_en as fulltexten, full_text_cy as fulltextcy,
            source_url as sourceurl, confidence
     FROM spoken_contributions
     WHERE meeting_id=$1 AND contribution_id=$2
     LIMIT 10`,
    [mId, cId]
  );

  if (!rows.length)
    return NextResponse.json({ error: "Contribution not found" }, { status: 404 });

  return NextResponse.json({
    meetingId: mId,
    contributionId: cId,
    speakers: rows.map((r) => ({
      memberId: r.memberId,
      speakerName: r.speakername,
      occurredAt: r.occurredat,
      contextEn: r.contexten,
      contextCy: r.contextcy,
      snippetEn: r.snippeten,
      snippetCy: r.snippetcy,
      fullTextEn: r.fulltexten,
      fullTextCy: r.fulltextcy,
      sourceUrl: r.sourceurl,
      confidence: r.confidence,
    })),
  });
}
