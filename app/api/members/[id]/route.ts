import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { fetchMS } from "@/lib/sources/twfy";

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
      const imageUrl = item.image ? `https://www.theyworkforyou.com${item.image}` : null;
      return NextResponse.json({
        id,
        name: item.full_name || item.name,
        party: item.party ?? null,
        areaName: item.constituency ?? null,
        areaType: "Constituency",
        profileUrl: null,
        imageUrl,
        updatedAt: Date.now(),
      });
    }
  }

  const { data: row } = await supabase()
    .from("members")
    .select("id,name,party,area_name,area_type,profile_url,senedd_uid,image_url,updated_at")
    .eq("id", id)
    .maybeSingle<any>();

  if (row) {
    return NextResponse.json({
      id: row.id,
      name: row.name,
      party: row.party,
      areaName: row.area_name,
      areaType: row.area_type,
      profileUrl: row.profile_url,
      imageUrl: row.image_url ? row.image_url : null,
      updatedAt: Number(row.updated_at),
    });
  }

  return NextResponse.json(
    { error: "Member not found (not cached yet)" },
    { status: 404 }
  );
}
