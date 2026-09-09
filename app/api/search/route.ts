import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fetchMS, fetchAllMSs, twfyMemberId, twfyPhotoUrl } from "@/lib/sources/twfy";
import { getRegionForConstituency } from "@/lib/geo/seneddRegions";
import {
  ensureMemberDirectorySeeded,
  upsertDirectoryMembers,
  searchMembersByAreaOrName,
} from "@/lib/services/memberDirectory";
import { logServerSideError } from "@/lib/services/errorLog";


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
      // Search can still work from directory
    }

    if (looksLikeUkPostcode(q)) {
      // 1. Direct TheyWorkForYou postcode lookup (returns constituency MS + regional MSs)
      const twfyMembers = await fetchMS({ postcode: q });
      
      if (twfyMembers.length > 0) {
        await upsertDirectoryMembers(
          twfyMembers.map((m) => ({
            personId: m.person_id,
            name: m.full_name || m.name,
            party: m.party,
            constituency: m.constituency,
          })),
        );

        // If TheyWorkForYou returned only the 1 constituency MS, also attach the 4 regional MSs for that region
        const allMSs = await fetchAllMSs();
        const combined = [...twfyMembers];

        for (const m of twfyMembers) {
          const region = getRegionForConstituency(m.constituency);
          if (region) {
            const regionalMSs = allMSs.filter(
              (cand) => cand.constituency.toLowerCase() === region.toLowerCase()
            );
            for (const regMS of regionalMSs) {
              if (!combined.some((ex) => ex.person_id === regMS.person_id)) {
                combined.push(regMS);
              }
            }
          }
        }

        const members = combined.map((m) => ({
          id: twfyMemberId(m.person_id),
          name: m.full_name || m.name,
          party: m.party,
          areaName: m.constituency,
          areaType: (m.constituency.includes("Wales") ? "Region" : "Constituency") as "Constituency" | "Region",
          imageUrl: m.image ? `https://www.theyworkforyou.com${m.image}` : twfyPhotoUrl(m.person_id),
        }));

        return NextResponse.json({
          kind: "postcode",
          query: q,
          members,
          sourceUrl: `https://www.theyworkforyou.com/api/getMS?postcode=${encodeURIComponent(q)}`,
          fromCache: true,
          notes: [],
        });
      }
    }

    // Name or area search using TheyWorkForYou directory
    const members = await searchMembersByAreaOrName(q);
    return NextResponse.json({
      kind: "constituency_or_ward",
      query: q,
      members,
      sourceUrl: "https://www.theyworkforyou.com/api/getMSs",
      fromCache: true,
    });
  } catch (e: unknown) {
    const { errorRef, publicMessage } = await logServerSideError({
      endpoint: "/api/search",
      error: e,
      metadata: { query: q },
    });
    return NextResponse.json(
      { error: publicMessage, errorRef },
      { status: 502 }
    );
  }
}


