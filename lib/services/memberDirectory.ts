import { supabase } from "../db";
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
  members: Array<{ personId: string; name: string; party?: string; constituency: string; image?: string }>,
): Promise<void> {
  const now = Date.now();
  await (supabase() as any).from("members").upsert(
    members.map((m) => ({
      id: twfyMemberId(m.personId),
      name: m.name,
      party: m.party ?? null,
      area_name: m.constituency,
      area_type: "Constituency",
      profile_url: null,
      image_url: m.image ? `https://www.theyworkforyou.com${m.image}` : twfyPhotoUrl(m.personId),
      updated_at: now,
      last_updated_at: now,
    })),
    { onConflict: "id" },
  );
}

export async function findMembersForConstituency(constituencyName: string): Promise<DirectoryMember[]> {
  const { data } = await supabase()
    .from("members")
    .select("id,name,party,area_name,area_type,profile_url,image_url")
    .ilike("area_name", constituencyName)
    .order("name", { ascending: true });
  return (data ?? []).map(mapRow);
}

export async function searchMembersByAreaOrName(queryStr: string): Promise<DirectoryMember[]> {
  const q = queryStr.trim();
  if (!q) return [];

  const live = await fetchAllMSs();
  const liveMatches = live
    .filter((m) => {
      const name = `${m.full_name || m.name} ${m.constituency} ${m.party}`.toLowerCase();
      return name.includes(q.toLowerCase());
    })
    .map((m) => ({
      id: twfyMemberId(m.person_id),
      name: m.full_name || m.name,
      party: m.party ?? undefined,
      areaName: m.constituency,
      areaType: "Constituency" as const,
      profileUrl: undefined,
      imageUrl: m.image ? `https://www.theyworkforyou.com${m.image}` : twfyPhotoUrl(m.person_id),
    }));
  if (liveMatches.length) return liveMatches;

  const { data: exactArea } = await supabase()
    .from("members")
    .select("id,name,party,area_name,area_type,profile_url,image_url")
    .ilike("area_name", q)
    .order("name", { ascending: true });
  if (exactArea?.length) return exactArea.map(mapRow);

  const { data } = await supabase()
    .from("members")
    .select("id,name,party,area_name,area_type,profile_url,image_url")
    .ilike("name", `%${q}%`)
    .order("name", { ascending: true })
    .limit(20);
  const cached = (data ?? []).map(mapRow);
  if (cached.length) return cached;
  return [];
}

function mapRow(m: any): DirectoryMember {
  return {
    id: m.id,
    name: m.name,
    party: m.party ?? undefined,
    areaName: m.area_name,
    areaType: m.area_type,
    profileUrl: m.profile_url ?? undefined,
    imageUrl: m.image_url ?? undefined,
  };
}
