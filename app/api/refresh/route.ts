import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ensureMemberDirectorySeeded } from "@/lib/services/memberDirectory";
import { indexRecentPlenarySpokenContributions } from "@/lib/extract/spokenContributions";
import { indexRecentPlenaryVotes } from "@/lib/extract/votes";

const bodySchema = z
  .object({
    maxMeetings: z.number().int().min(1).max(20).optional(),
    force: z.boolean().optional(),
  })
  .optional();

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const maxMeetings = parsed.data?.maxMeetings ?? 8;
  const force = parsed.data?.force ?? false;

  try {
    const startedAt = new Date().toISOString();
    await ensureMemberDirectorySeeded();
    const spoken = await indexRecentPlenarySpokenContributions({ maxMeetings, force });
    const votes = await indexRecentPlenaryVotes({ maxMeetings, force });
    const contributionsInserted = spoken.meetings.reduce(
      (sum, m) => sum + (m.contributionsInserted ?? 0),
      0
    );
    const votesRowsUpserted = votes.meetings.reduce(
      (sum, m) => sum + (m.rowsUpserted ?? 0),
      0
    );

    return NextResponse.json({
      ok: true,
      startedAt,
      finishedAt: new Date().toISOString(),
      maxMeetings,
      force,
      meetings: spoken.meetings,
      votesMeetings: votes.meetings,
      contributionsInserted,
      votesRowsUpserted,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: "Refresh failed", detail: String((e as Error)?.message ?? e) },
      { status: 502 }
    );
  }
}
