import { NextRequest, NextResponse } from "next/server";
import { getConvexClient, isConvexConfigured, localDb } from "@/lib/db";
import { fetchMS, fetchPersonHistory, twfyPhotoUrl } from "@/lib/sources/twfy";
import { logServerSideError } from "@/lib/services/errorLog";

export const dynamic = "force-dynamic";

function formatHouseName(house: number): string {
  if (house === 5) return "Senedd Cymru / Welsh Parliament";
  if (house === 1) return "House of Commons (Westminster)";
  if (house === 2) return "House of Lords";
  if (house === 3) return "Scottish Parliament";
  if (house === 4) return "Northern Ireland Assembly";
  return "Parliamentary Office";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rawId = (await params).id;
  const id = decodeURIComponent(rawId);

  try {
    if (id.startsWith("twfy:")) {
      const personId = id.slice("twfy:".length);
      const [ms, rawTerms] = await Promise.all([
        fetchMS({ personId }),
        fetchPersonHistory(personId),
      ]);
      const item = ms[0];
      if (item) {
        const imageUrl = item.image
          ? (item.image.startsWith("http") ? item.image : `https://www.theyworkforyou.com${item.image}`)
          : twfyPhotoUrl(personId);

        // Process career terms
        const terms = rawTerms.map((t) => {
          const startYear = t.entered_house ? t.entered_house.slice(0, 4) : undefined;
          const endYear = (!t.left_house || t.left_house.startsWith("9999")) ? "Present" : t.left_house.slice(0, 4);
          const isCurrent = endYear === "Present" || t.left_reason === "still_in_office";
          return {
            house: formatHouseName(t.house),
            constituency: t.constituency || undefined,
            party: t.party || undefined,
            startYear,
            endYear,
            isCurrent,
          };
        });

        // Find first elected year
        const startYears = terms.map(t => parseInt(t.startYear || "0", 10)).filter(y => y > 1900);
        const minYear = startYears.length ? Math.min(...startYears) : null;
        const totalTerms = terms.length;
        const tenureSummary = minYear
          ? `Serving in elected office since ${minYear} (${totalTerms} term${totalTerms > 1 ? "s" : ""})`
          : undefined;

        return NextResponse.json({
          id,
          name: item.full_name || item.name,
          party: item.party ?? null,
          areaName: item.constituency ?? null,
          areaType: item.constituency?.includes("Wales") ? "Region" : "Constituency",
          profileUrl: null,
          imageUrl,
          updatedAt: Date.now(),
          history: {
            tenureSummary,
            firstElectedYear: minYear ? String(minYear) : undefined,
            terms,
          },
        });
      }
    }

    // Check Convex
    if (isConvexConfigured()) {
      try {
        const client = getConvexClient();
        if (client) {
          const row = await (client as any).query("members:getById", { id });
          if (row) {
            return NextResponse.json({
              id: row.id,
              name: row.name,
              party: row.party ?? null,
              areaName: row.area_name ?? null,
              areaType: row.area_type ?? null,
              profileUrl: row.profile_url ?? null,
              imageUrl: row.image_url ?? null,
              updatedAt: Number(row.updated_at),
            });
          }
        }
      } catch {
        // Fallback
      }
    }

    // Check local store
    const local = localDb.members.get(id);
    if (local) {
      return NextResponse.json({
        id: local.id,
        name: local.name,
        party: local.party ?? null,
        areaName: local.area_name ?? null,
        areaType: local.area_type ?? null,
        profileUrl: local.profile_url ?? null,
        imageUrl: local.image_url ?? null,
        updatedAt: Number(local.updated_at),
      });
    }

    return NextResponse.json(
      { error: "Member not found" },
      { status: 404 }
    );
  } catch (e: unknown) {
    const { errorRef, publicMessage } = await logServerSideError({
      endpoint: `/api/members/${id}`,
      error: e,
      metadata: { memberId: id },
    });
    return NextResponse.json(
      { error: publicMessage, errorRef },
      { status: 500 }
    );
  }
}

