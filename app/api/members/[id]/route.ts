import { NextRequest, NextResponse } from "next/server";
import { getConvexClient, isConvexConfigured, localDb } from "@/lib/db";
import { fetchMS, twfyPhotoUrl } from "@/lib/sources/twfy";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rawId = (await params).id;
  const id = decodeURIComponent(rawId);

  if (id.startsWith("twfy:")) {
    const personId = id.slice("twfy:".length);
    const ms = await fetchMS({ personId });
    const item = ms[0];
    if (item) {
      const imageUrl = item.image
        ? (item.image.startsWith("http") ? item.image : `https://www.theyworkforyou.com${item.image}`)
        : twfyPhotoUrl(personId);

      return NextResponse.json({
        id,
        name: item.full_name || item.name,
        party: item.party ?? null,
        areaName: item.constituency ?? null,
        areaType: item.constituency?.includes("Wales") ? "Region" : "Constituency",
        profileUrl: null,
        imageUrl,
        updatedAt: Date.now(),
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
}
