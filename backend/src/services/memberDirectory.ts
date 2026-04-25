import type { Db } from "../db.js";
import { fetchSixthSeneddElectedMembers } from "../sources/seneddElections.js";

export type DirectoryMember = {
  id: string;
  name: string;
  party?: string;
  areaName: string;
  areaType: "Constituency" | "Region";
  profileUrl?: string;
};

export async function ensureMemberDirectorySeeded(db: Db) {
  const count = db
    .prepare(`SELECT COUNT(1) as c FROM members WHERE id LIKE 'senedd-6:%'`)
    .get() as { c: number };
  const hasDirectory = (count?.c ?? 0) >= 40;
  if (hasDirectory) return;

  const fetched = await fetchSixthSeneddElectedMembers(db);
  upsertDirectoryMembers(db, fetched.members);
}

export function upsertDirectoryMembers(db: Db, members: Array<{ term: string; name: string; party?: string; areaName: string; areaType: "Constituency" | "Region" }>) {
  const now = Date.now();
  const stmt = db.prepare(
    `INSERT INTO members(id, name, party, area_name, area_type, profile_url, image_url, updated_at, last_updated_at)
     VALUES(@id, @name, @party, @area_name, @area_type, NULL, NULL, @updated_at, @last_updated_at)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name,
       party=COALESCE(excluded.party, members.party),
       area_name=COALESCE(excluded.area_name, members.area_name),
       area_type=COALESCE(excluded.area_type, members.area_type),
       updated_at=excluded.updated_at,
       last_updated_at=excluded.last_updated_at`,
  );

  const tx = db.transaction(() => {
    for (const m of members) {
      const id = makeMemberId(m.term, m.name, m.areaType, m.areaName);
      stmt.run({
        id,
        name: m.name,
        party: m.party ?? null,
        area_name: m.areaName,
        area_type: m.areaType,
        updated_at: now,
        last_updated_at: now,
      });
    }
  });
  tx();
}

export function findMembersForAreas(db: Db, args: { constituencyName?: string; regionName?: string }): DirectoryMember[] {
  const out: DirectoryMember[] = [];

  if (args.constituencyName) {
    const row = db
      .prepare(
        `SELECT id, name, party, area_name as areaName, area_type as areaType, profile_url as profileUrl
         FROM members
         WHERE lower(area_type) = 'constituency' AND lower(area_name) = lower(?)
         ORDER BY updated_at DESC
         LIMIT 1`,
      )
      .get(args.constituencyName) as DirectoryMember | undefined;
    if (row) out.push(row);
  }

  if (args.regionName) {
    const rows = db
      .prepare(
        `SELECT id, name, party, area_name as areaName, area_type as areaType, profile_url as profileUrl
         FROM members
         WHERE lower(area_type) = 'region' AND lower(area_name) = lower(?)
         ORDER BY name ASC`,
      )
      .all(args.regionName) as DirectoryMember[];
    out.push(...rows);
  }

  return out;
}

export function searchMembersByAreaOrName(db: Db, query: string): DirectoryMember[] {
  const q = query.trim();
  if (!q) return [];

  // Try exact area name first (constituency/region).
  const exactArea = db
    .prepare(
      `SELECT id, name, party, area_name as areaName, area_type as areaType, profile_url as profileUrl
       FROM members
       WHERE lower(area_name) = lower(?)
       ORDER BY area_type ASC, name ASC`,
    )
    .all(q) as DirectoryMember[];
  if (exactArea.length) return exactArea;

  // Fallback: name contains query.
  const like = `%${q.toLowerCase()}%`;
  return db
    .prepare(
      `SELECT id, name, party, area_name as areaName, area_type as areaType, profile_url as profileUrl
       FROM members
       WHERE lower(name) LIKE ?
       ORDER BY name ASC
       LIMIT 20`,
    )
    .all(like) as DirectoryMember[];
}

function makeMemberId(term: string, name: string, areaType: string, areaName: string) {
  const base = slug(name);
  const disambiguator = slug(`${areaType}-${areaName}`).slice(0, 40);
  return `senedd-${term}:${base}:${disambiguator}`;
}

function slug(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}
