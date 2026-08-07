/**
 * TheyWorkForYou API integration for Welsh Senedd Members (MS/AS).
 * API docs: https://www.theyworkforyou.com/api/
 */
import { env } from "../env";

const BASE = "https://www.theyworkforyou.com/api";

export type TwfyMS = {
  member_id: string;
  person_id: string;
  name: string;
  party: string;
  constituency: string;
  image?: string;
  full_name?: string;
  given_name?: string;
  family_name?: string;
};

/** Returns all current Members of the Senedd from TheyWorkForYou. */
export async function fetchAllMSs(): Promise<TwfyMS[]> {
  const url = `${BASE}/getMSs?output=json&key=${encodeURIComponent(env.twfyApiKey)}`;
  const res = await fetch(url, {
    headers: { "user-agent": "SeneddTrackerMVP/1.0 (+academic project)" },
    next: { revalidate: 3600 }, // cache for 1 hour in Next.js
  });
  if (!res.ok) throw new Error(`TWFY getMSs failed (${res.status})`);
  const data = (await res.json()) as TwfyMS[] | { error: string };
  if (!Array.isArray(data)) throw new Error(`TWFY getMSs error: ${JSON.stringify(data)}`);
  return data;
}

/** Returns one or more MSs by TWFY person_id or constituency postcode. */
export async function fetchMS(args: { personId?: string; postcode?: string }): Promise<TwfyMS[]> {
  const params = new URLSearchParams({ output: "json", key: env.twfyApiKey });
  if (args.personId) params.set("id", args.personId);
  if (args.postcode) params.set("postcode", args.postcode);
  const url = `${BASE}/getMS?${params.toString()}`;
  const res = await fetch(url, {
    headers: { "user-agent": "SeneddTrackerMVP/1.0 (+academic project)" },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as TwfyMS | TwfyMS[] | { error: string };
  if (Array.isArray(data)) return data;
  if ("error" in data) return [];
  return [data];
}

/** Photo URL for a TheyWorkForYou person. */
export function twfyPhotoUrl(personId: string): string {
  return `https://www.theyworkforyou.com/people-images/mpsL/${personId}.jpeg`;
}

/** Make a stable member ID from a TWFY person_id. */
export function twfyMemberId(personId: string): string {
  return `twfy:${personId}`;
}
