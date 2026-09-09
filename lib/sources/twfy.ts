/**
 * TheyWorkForYou API integration for Welsh Senedd Members (MS/AS),
 * debates, speeches, and parliamentary participation.
 *
 * API documentation: https://www.theyworkforyou.com/api/
 */
import { env } from "../env";
import { cachedFetchText } from "../httpCache";

const BASE = "https://www.theyworkforyou.com/api";

// Caching TTL definitions (in seconds)
export const TTL_SEVEN_DAYS = 7 * 24 * 60 * 60; // 604800s for postcodes and MS directories
export const TTL_ONE_HOUR = 60 * 60; // 3600s for live speeches and debates

export type TwfyMS = {
  member_id: string | number;
  person_id: string | number;
  name: string;
  party: string;
  constituency: string;
  image?: string;
  full_name?: string;
  given_name?: string;
  family_name?: string;
};

export type TwfyDebateItem = {
  gid: string;
  hdate: string;
  htime?: string;
  epheading?: string;
  body: string;
  speaker_id?: string;
  person_id?: string | number;
  speaker?: {
    member_id?: string | number;
    person_id?: string | number;
    name?: string;
    party?: string;
    constituency?: string;
  };
  parent?: {
    body?: string;
    epheading?: string;
  };
  listurl?: string;
};

/** 
 * Returns all current Members of the Senedd from TheyWorkForYou.
 * Cached for 7 days in Convex/memory since elected members rarely change.
 */
export async function fetchAllMSs(): Promise<TwfyMS[]> {
  if (env.twfyApiKey) {
    try {
      const url = `${BASE}/getMSs?output=json&key=${encodeURIComponent(env.twfyApiKey)}`;
      const res = await cachedFetchText({
        url,
        source: "twfy-getMSs",
        ttlSeconds: TTL_SEVEN_DAYS,
      });

      if (res.status >= 200 && res.status < 300) {
        const data = JSON.parse(res.body) as TwfyMS[] | { error: string };
        if (Array.isArray(data) && data.length > 0) return data;
      }
    } catch (e) {
      console.error("TheyWorkForYou fetchAllMSs error:", e);
    }
  }
  return [];
}

/** 
 * Returns one or more MSs by TWFY person_id or constituency postcode.
 * Cached for 7 days in Convex/memory so repeat postcode searches are instant.
 */
export async function fetchMS(args: { personId?: string | number; postcode?: string }): Promise<TwfyMS[]> {
  if (env.twfyApiKey) {
    try {
      const params = new URLSearchParams({ output: "json", key: env.twfyApiKey });
      if (args.personId) params.set("id", String(args.personId).replace(/^twfy:/, ""));
      if (args.postcode) params.set("postcode", args.postcode.trim().toUpperCase());
      const url = `${BASE}/getMS?${params.toString()}`;

      const res = await cachedFetchText({
        url,
        source: args.postcode ? "twfy-postcode" : "twfy-person",
        ttlSeconds: TTL_SEVEN_DAYS,
        cacheKeyHint: args.postcode ? args.postcode.trim().toUpperCase() : String(args.personId),
      });

      if (res.status >= 200 && res.status < 300) {
        const data = JSON.parse(res.body) as TwfyMS | TwfyMS[] | { error: string };
        if (Array.isArray(data)) return data;
        if (!("error" in data)) return [data];
      }
    } catch (e) {
      console.error("TheyWorkForYou fetchMS error:", e);
    }
  }

  return [];
}

/**
 * Returns Senedd debates/speeches from TheyWorkForYou API.
 * Uses a 1-hour cache TTL so newly held meetings are discovered frequently,
 * with stale-while-revalidate protection.
 */
export async function fetchSeneddDebates(args?: {
  personId?: string | number;
  search?: string;
  num?: number;
  page?: number;
  order?: "d" | "r";
}): Promise<TwfyDebateItem[]> {
  if (env.twfyApiKey) {
    try {
      const params = new URLSearchParams({
        type: "senedd",
        output: "json",
        key: env.twfyApiKey,
        num: String(args?.num ?? 50),
        page: String(args?.page ?? 1),
        order: args?.order ?? "d",
      });

      if (args?.personId) {
        const rawPid = String(args.personId).replace(/^twfy:/, "");
        params.set("person", rawPid);
      }
      if (args?.search) {
        params.set("search", args.search);
      }

      const url = `${BASE}/getDebates?${params.toString()}`;
      const res = await cachedFetchText({
        url,
        source: "twfy-debates",
        ttlSeconds: TTL_ONE_HOUR,
      });

      if (res.status >= 200 && res.status < 300) {
        const data = JSON.parse(res.body);
        if (data && Array.isArray(data.rows)) return data.rows;
        if (Array.isArray(data)) return data;
      }
    } catch (e) {
      console.error("TheyWorkForYou fetchSeneddDebates error:", e);
    }
  }

  return [];
}

/** Photo URL for a TheyWorkForYou person. */
export function twfyPhotoUrl(personId: string | number): string {
  const pid = String(personId).replace(/^twfy:/, "");
  return `https://www.theyworkforyou.com/people-images/mpsL/${pid}.jpeg`;
}

/** Make a stable member ID from a TWFY person_id. */
export function twfyMemberId(personId: string | number): string {
  const pid = String(personId).replace(/^twfy:/, "");
  return `twfy:${pid}`;
}
