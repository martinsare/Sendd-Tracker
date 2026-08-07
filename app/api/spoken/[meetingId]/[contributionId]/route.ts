import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ meetingId: string; contributionId: string }> }
) {
  const { meetingId, contributionId } = await params;
  const mId = parseInt(meetingId, 10);
  const cId = parseInt(contributionId, 10);

  if (!Number.isFinite(mId) || !Number.isFinite(cId))
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const { data } = await supabase()
    .from("spoken_contributions")
    .select("id,member_id,speaker_name,occurred_at,context_en,context_cy,snippet_en,snippet_cy,full_text_en,full_text_cy,source_url,confidence")
    .eq("meeting_id", mId)
    .eq("contribution_id", cId)
    .limit(10);

  if (!(data ?? []).length)
    return NextResponse.json({ error: "Contribution not found" }, { status: 404 });

  return NextResponse.json({
    meetingId: mId,
    contributionId: cId,
    speakers: (data ?? []).map((r: any) => ({
      memberId: r.member_id,
      speakerName: r.speaker_name,
      occurredAt: r.occurred_at,
      contextEn: r.context_en,
      contextCy: r.context_cy,
      snippetEn: r.snippet_en,
      snippetCy: r.snippet_cy,
      fullTextEn: r.full_text_en,
      fullTextCy: r.full_text_cy,
      sourceUrl: r.source_url,
      confidence: r.confidence,
    })),
  });
}
