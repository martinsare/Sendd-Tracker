import { NextRequest, NextResponse } from "next/server";
import { getConvexClient, isConvexConfigured, localDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ meetingId: string; contributionId: string }> }
) {
  const { meetingId, contributionId } = await params;
  const mId = parseInt(meetingId, 10);
  const cId = parseInt(contributionId, 10);

  if (!Number.isFinite(mId) || !Number.isFinite(cId))
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  let data: any[] = [];
  if (isConvexConfigured()) {
    try {
      const client = getConvexClient();
      if (client) {
        data = await (client as any).query("contributions:getDetail", {
          meetingId: mId,
          contributionId: cId,
        });
      }
    } catch {
      // Fallback
    }
  }

  if (!data.length) {
    const key = `${mId}:${cId}`;
    const local = localDb.spokenContributions.get(key);
    if (local) data = [local];
  }

  if (!data.length)
    return NextResponse.json({ error: "Contribution not found" }, { status: 404 });

  return NextResponse.json({
    meetingId: mId,
    contributionId: cId,
    speakers: data.map((r: any) => ({
      memberId: r.member_id,
      speakerName: r.speaker_name,
      occurredAt: r.occurred_at,
      contextEn: r.context_en ?? null,
      contextCy: r.context_cy ?? null,
      snippetEn: r.snippet_en,
      snippetCy: r.snippet_cy ?? null,
      fullTextEn: r.full_text_en ?? null,
      fullTextCy: r.full_text_cy ?? null,
      sourceUrl: r.source_url,
      confidence: r.confidence,
    })),
  });
}
