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
  const url = new URL(_req.url);
  const memberIdQuery = url.searchParams.get("memberId");

  const chosen = (memberIdQuery ? data.find((r: any) => r.member_id === memberIdQuery) : null) ?? data[0];

  return NextResponse.json({
    meetingId: mId,
    contributionId: cId,
    memberId: chosen.member_id,
    speakerName: chosen.speaker_name,
    occurredAt: chosen.occurred_at,
    contextEn: chosen.context_en ?? null,
    contextCy: chosen.context_cy ?? null,
    snippetEn: chosen.snippet_en,
    snippetCy: chosen.snippet_cy ?? null,
    fullTextEn: chosen.full_text_en ?? chosen.snippet_en ?? null,
    fullTextCy: chosen.full_text_cy ?? chosen.snippet_cy ?? null,
    sourceUrl: chosen.source_url,
    confidence: chosen.confidence,
    transcriptXmlUrl: `https://record.senedd.wales/XMLExport/Plenary/${mId}`,
    recordPageUrl: `https://record.senedd.wales/Plenary/${mId}`,
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
