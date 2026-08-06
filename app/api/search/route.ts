import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { lookupSeneddAreasByPostcode } from "@/lib/sources/mapit";
import {
  ensureMemberDirectorySeeded,
  findMembersForConstituency,
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
    await ensureMemberDirectorySeeded();

    if (looksLikeUkPostcode(q)) {
      const areas = await lookupSeneddAreasByPostcode(q);
      const constituencyName = areas.constituencyName ?? areas.regionName;
      const members = constituencyName
        ? await findMembersForConstituency(constituencyName)
        : [];

      return NextResponse.json({
        kind: "postcode",
        query: q,
        areas: {
          constituency: areas.constituencyName ?? null,
          region: areas.regionName ?? null,
        },
        members,
        sourceUrl: areas.mapitUrl,
        fromCache: areas.fromCache,
        notes:
          members.length === 0
            ? ["No members matched the mapped constituency/region yet. Try searching by member name."]
            : [],
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
