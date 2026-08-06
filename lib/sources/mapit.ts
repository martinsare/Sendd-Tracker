import { cachedFetchText } from "../httpCache";
import { env } from "../env";

const SOURCE = "mapit-postcode";
const BASE = "https://mapit.mysociety.org/postcode";

export type MapItAreas = {
  postcode: string;
  constituencyName?: string;
  regionName?: string;
  mapitUrl: string;
  fromCache: boolean;
};

export async function lookupSeneddAreasByPostcode(postcodeRaw: string): Promise<MapItAreas> {
  const postcode = postcodeRaw.trim().toUpperCase();
  const url = `${BASE}/${encodeURIComponent(postcode)}`;
  const fetched = await cachedFetchText({ url, source: SOURCE, ttlSeconds: env.cacheTtlSeconds });
  if (fetched.status < 200 || fetched.status >= 300)
    throw new Error(`MapIt lookup failed (${fetched.status})`);

  const json = JSON.parse(fetched.body) as Record<string, unknown>;
  const areas = (json?.areas ?? {}) as Record<string, { type?: string; name?: string }>;

  const constituency = pickFirstAreaName(areas, ["WAC"]);
  const region = pickFirstAreaName(areas, ["WAE"]);

  return {
    postcode,
    constituencyName: constituency ?? undefined,
    regionName: region ?? undefined,
    mapitUrl: url,
    fromCache: fetched.fromCache,
  };
}

function pickFirstAreaName(areas: Record<string, { type?: string; name?: string }>, types: string[]) {
  for (const a of Object.values(areas)) {
    if (!a?.type || !a?.name) continue;
    if (types.includes(String(a.type))) return String(a.name);
  }
  return null;
}
