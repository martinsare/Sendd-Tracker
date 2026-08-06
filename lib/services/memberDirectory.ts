import { query, transaction } from "../db";
import { fetchAllMSs, twfyMemberId, twfyPhotoUrl } from "../sources/twfy";

export type DirectoryMember = {
  id: string;
  name: string;
  party?: string;
  areaName: string;
  areaType: "Constituency" | "Region";
  profileUrl?: string;
  imageUrl?: string;
};

  /** Ensure the member directory has been seeded from TWFY. */
export async function ensureMemberDirectorySeeded(): Promise<void> {
  const members = await fetchAllMSs();
  await upsertDirectoryMembers(members.map((m) => ({
    personId: m.person_id,
    name: m.name,
    party: m.party,
    constituency: m.constituency,
  })));
}

/** Upsert members from TWFY data into the members table. */
export async function upsertDirectoryMembers(
  members: Array<{ personId: string; name: string; party?: string; constituency: string }>
): Promise<void> {
  const now = Date.now();
  await transaction(async (client) => {
    for (const m of members) {
      const id = twfyMemberId(m.personId);
      const imageUrl = twfyPhotoUrl(m.personId);
      await client.query(
        `INSERT INTO members(id, name, party, area_name, area_type, profile_url, image_url, updated_at, last_updated_at)
         VALUES($1, $2, $3, $4, 'Constituency', NULL, $5, $6, $7)
         ON CONFLICT(id) DO UPDATE SET
           name=EXCLUDED.name,
           party=COALESCE(EXCLUDED.party, members.party),
           area_name=COALESCE(EXCLUDED.area_name, members.area_name),
           image_url=COALESCE(EXCLUDED.image_url, members.image_url),
           updated_at=EXCLUDED.updated_at,
           last_updated_at=EXCLUDED.last_updated_at`,
        [id, m.name, m.party ?? null, m.constituency, imageUrl, now, now]
      );
    }
  });
}

/** Find all MSs for the given constituency name (case-insensitive). */
export async function findMembersForConstituency(
  constituencyName: string
): Promise<DirectoryMember[]> {
  const { rows } = await query<DirectoryMember>(
    `SELECT id, name, party, area_name as "areaName", area_type as "areaType",
            profile_url as "profileUrl", image_url as "imageUrl"
     FROM members
     WHERE LOWER(area_name) = LOWER($1)
     ORDER BY name ASC`,
    [constituencyName]
  );
  return rows.map(withPhotoProxyUrl);
}

/** Search members by name or area name. */
export async function searchMembersByAreaOrName(queryStr: string): Promise<DirectoryMember[]> {
  const q = queryStr.trim();
  if (!q) return [];

  // Exact area name match first
  const { rows: exactArea } = await query<DirectoryMember>(
    `SELECT id, name, party, area_name as "areaName", area_type as "areaType",
            profile_url as "profileUrl", image_url as "imageUrl"
     FROM members
     WHERE LOWER(area_name) = LOWER($1)
     ORDER BY name ASC`,
    [q]
  );
  if (exactArea.length) return exactArea.map(withPhotoProxyUrl);

  // Fallback: name contains query
  const { rows } = await query<DirectoryMember>(
    `SELECT id, name, party, area_name as "areaName", area_type as "areaType",
            profile_url as "profileUrl", image_url as "imageUrl"
     FROM members
     WHERE LOWER(name) LIKE LOWER($1)
     ORDER BY name ASC
     LIMIT 20`,
    [`%${q}%`]
  );
  return rows.map(withPhotoProxyUrl);
}

function withPhotoProxyUrl(m: DirectoryMember): DirectoryMember {
  if (!m.imageUrl) return m;
  return { ...m, imageUrl: `/api/members/${encodeURIComponent(m.id)}/photo` };
}
