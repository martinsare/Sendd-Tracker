import type { Db } from "../db.js";
import { cachedFetchText } from "../httpCache.js";
import { env } from "../env.js";

const SOURCE = "mapit-postcode";
const BASE = "https://mapit.mysociety.org/postcode";

export type MapItAreas = {
  postcode: string;
  constituencyName?: string;
  regionName?: string;
  mapitUrl: string;
  fromCache: boolean;
};

export async function lookupSeneddAreasByPostcode(db: Db, postcodeRaw: string): Promise<MapItAreas> {
  const postcode = postcodeRaw.trim().toUpperCase();
  const url = `${BASE}/${encodeURIComponent(postcode)}`;
  const fetched = await cachedFetchText(db, { url, source: SOURCE, ttlSeconds: env.cacheTtlSeconds });
  if (fetched.status < 200 || fetched.status >= 300) throw new Error(`MapIt lookup failed (${fetched.status})`);

  const json = JSON.parse(fetched.body) as any;
  const areas = json?.areas ?? {};

  // From MapIt: WAC = Welsh Assembly Constituency, WAE = Welsh Assembly Electoral region.
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

function pickFirstAreaName(areas: any, types: string[]) {
  for (const a of Object.values(areas ?? {})) {
    const area: any = a;
    if (!area?.type || !area?.name) continue;
    if (types.includes(String(area.type))) return String(area.name);
  }
  return null;
}

