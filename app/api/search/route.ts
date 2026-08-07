import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fetchMS } from "@/lib/sources/twfy";
import {
  ensureMemberDirectorySeeded,
  upsertDirectoryMembers,
  searchMembersByAreaOrName,
} from "@/lib/services/memberDirectory";

const querySchema = z.object({ q: z.string().min(1).max(200) });

function looksLikeUkPostcode(input: string) {
  const s = input.trim().toUpperCase();
  return (
    /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/.test(s) ||
    /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(s)
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const parsed = querySchema.safeParse({ q: searchParams.get("q") });
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });

  const q = parsed.data.q.trim();

  try {
    try {
      await ensureMemberDirectorySeeded();
    } catch {
      // Search can still work from already-cached members if TWFY is unavailable.
    }

    if (looksLikeUkPostcode(q)) {
      const twfyMembers = await fetchMS({ postcode: q });
      await upsertDirectoryMembers(
        twfyMembers.map((m) => ({
          personId: m.person_id,
          name: m.full_name || m.name,
          party: m.party,
          constituency: m.constituency,
        })),
      );
      const members = twfyMembers.map((m) => ({
        id: `twfy:${m.person_id}`,
        name: m.full_name || m.name,
        party: m.party,
        areaName: m.constituency,
        areaType: "Constituency" as const,
        imageUrl: m.image ? `https://www.theyworkforyou.com${m.image}` : undefined,
      }));

      return NextResponse.json({
        kind: "postcode",
        query: q,
        members,
        sourceUrl: `https://www.theyworkforyou.com/api/getMS?postcode=${encodeURIComponent(q)}`,
        fromCache: true,
        notes: members.length === 0 ? ["No members matched this postcode yet."] : [],
      });
    }

    const members = await searchMembersByAreaOrName(q);
    return NextResponse.json({
      kind: "constituency_or_ward",
      query: q,
      members,
      sourceUrl: "https://www.theyworkforyou.com/api/getMSs",
      fromCache: true,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: "Upstream lookup failed", detail: String((e as Error)?.message ?? e) },
      { status: 502 }
    );
  }
}
