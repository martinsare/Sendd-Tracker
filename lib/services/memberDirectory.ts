import { getConvexClient, isConvexConfigured, localDb } from "../db";
import { api } from "../../convex/_generated/api";
import { fetchAllMSs, twfyMemberId, twfyPhotoUrl } from "../sources/twfy";
import { getRegionForConstituency } from "../geo/seneddRegions";

export type DirectoryMember = {
  id: string;
  name: string;
  party?: string;
  areaName: string;
  areaType: "Constituency" | "Region";
  profileUrl?: string;
  imageUrl?: string;
};

// Welsh-to-English and English-to-Welsh area synonym mappings for robust matching
const AREA_SYNONYMS: Record<string, string[]> = {
  caerdydd: ["cardiff", "cardiff south and penarth", "cardiff west", "cardiff north", "cardiff central", "south wales central"],
  cardiff: ["caerdydd", "cardiff south and penarth", "cardiff west", "cardiff north", "cardiff central", "south wales central"],
  swansea: ["abertawe", "swansea east", "swansea west", "gower", "south wales west"],
  abertawe: ["swansea", "swansea east", "swansea west", "gower", "south wales west"],
  newport: ["casnewydd", "newport east", "newport west", "south wales east"],
  casnewydd: ["newport", "newport east", "newport west", "south wales east"],
  wrexham: ["wrecsam"],
  wrecsam: ["wrexham"],
  penarth: ["cardiff south and penarth"],
};

export async function ensureMemberDirectorySeeded(): Promise<void> {
  const members = await fetchAllMSs();
  await upsertDirectoryMembers(
    members.map((m) => ({
      personId: m.person_id,
      name: m.name,
      party: m.party,
      constituency: m.constituency,
      image: m.image,
    })),
  );
}

export async function upsertDirectoryMembers(
  members: Array<{ personId: string | number; name: string; party?: string; constituency: string; image?: string }>,
): Promise<void> {
  const now = Date.now();
  const formatted = members.map((m) => ({
    id: twfyMemberId(m.personId),
    name: m.name,
    party: m.party ?? undefined,
    area_name: m.constituency,
    area_type: m.constituency.includes("Wales") ? "Region" : "Constituency",
    profile_url: undefined,
    image_url: m.image ? `https://www.theyworkforyou.com${m.image}` : twfyPhotoUrl(m.personId),
    updated_at: now,
    last_updated_at: now,
  }));

  // Store in local in-memory DB
  for (const m of formatted) {
    localDb.members.set(m.id, m);
  }

  // Store in Convex if configured
  if (isConvexConfigured()) {
    try {
      const client = getConvexClient();
      if (client) {
        await client.mutation(api.members.upsertMembers, { members: formatted });
      }
    } catch {
      // Ignore mutation errors
    }
  }
}

export async function findMembersForConstituency(constituencyName: string): Promise<DirectoryMember[]> {
  return await searchMembersByAreaOrName(constituencyName);
}

export async function searchMembersByAreaOrName(queryStr: string): Promise<DirectoryMember[]> {
  const q = queryStr.trim().toLowerCase();
  if (!q) return [];

  const live = await fetchAllMSs();
  const searchTerms = [q];

  for (const [key, syns] of Object.entries(AREA_SYNONYMS)) {
    if (q.includes(key)) {
      searchTerms.push(...syns);
    }
  }

  // Direct matching members (by name, constituency, or party)
  const matchedMSs = live.filter((m) => {
    const text = `${m.full_name || m.name} ${m.constituency} ${m.party}`.toLowerCase();
    return searchTerms.some((t) => text.includes(t) || t.includes(m.constituency.toLowerCase()));
  });

  // If any matched member is a Constituency MS, also include the 4 Regional MSs representing that region
  const additionalRegions = new Set<string>();
  for (const m of matchedMSs) {
    const reg = getRegionForConstituency(m.constituency);
    if (reg) {
      additionalRegions.add(reg.toLowerCase());
    }
  }

  // Also check if the search term itself matches a known constituency
  const directRegion = getRegionForConstituency(queryStr);
  if (directRegion) {
    additionalRegions.add(directRegion.toLowerCase());
  }

  // Combine matched members with any additional regional MSs
  const allResults = [...matchedMSs];
  if (additionalRegions.size > 0) {
    for (const m of live) {
      if (additionalRegions.has(m.constituency.toLowerCase())) {
        if (!allResults.some((existing) => existing.person_id === m.person_id)) {
          allResults.push(m);
        }
      }
    }
  }

  return allResults.map((m) => ({
    id: twfyMemberId(m.person_id),
    name: m.full_name || m.name,
    party: m.party ?? undefined,
    areaName: m.constituency,
    areaType: (m.constituency.includes("Wales") ? "Region" : "Constituency") as "Constituency" | "Region",
    profileUrl: undefined,
    imageUrl: m.image ? `https://www.theyworkforyou.com${m.image}` : twfyPhotoUrl(m.person_id),
  }));
}
