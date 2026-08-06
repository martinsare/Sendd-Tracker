import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

type MemberRow = {
  id: string;
  name: string;
  party: string | null;
  areaname: string | null;
  areatype: string | null;
  profileurl: string | null;
  senedduid: number | null;
  rawimageurl: string | null;
  updatedat: string;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { rows } = await query<MemberRow>(
    `SELECT id, name, party, area_name as areaname, area_type as areatype,
            profile_url as profileurl, senedd_uid as senedduid,
            image_url as rawimageurl, updated_at as updatedat
     FROM members WHERE id = $1`,
    [id]
  );

  const row = rows[0];
  if (!row)
    return NextResponse.json(
      { error: "Member not found (not cached yet)" },
      { status: 404 }
    );

  const imageUrl =
    row.senedduid != null || row.rawimageurl
      ? `/api/members/${encodeURIComponent(row.id)}/photo`
      : null;

  return NextResponse.json({
    id: row.id,
    name: row.name,
    party: row.party,
    areaName: row.areaname,
    areaType: row.areatype,
    profileUrl: row.profileurl,
    imageUrl,
    updatedAt: Number(row.updatedat),
  });
}
