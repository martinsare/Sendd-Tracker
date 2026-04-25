import { parseStringPromise } from "xml2js";
import type { Db } from "../db.js";
import { cachedFetchText } from "../httpCache.js";

const SOURCE = "senedd-business-mgwebservice";
const BASE = "https://business.senedd.wales/mgwebservice.asmx";

export type MsLite = {
  id: string;
  name: string;
  party?: string;
  areaName?: string;
  areaType?: string;
  profileUrl?: string;
};

function safeText(v: unknown): string | undefined {
  if (typeof v === "string") return v.trim() || undefined;
  return undefined;
}

function coerceArray<T>(v: T | T[] | undefined): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function pickFirst(obj: any, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj?.[k];
    const s = safeText(v);
    if (s) return s;
  }
  return undefined;
}

function normalizeCouncillor(item: any): MsLite | null {
  const id =
    pickFirst(item, ["CouncillorId", "councillorId", "Id", "id"]) ??
    pickFirst(item, ["UID", "uid"]);
  const name =
    pickFirst(item, ["Name", "name", "FullName", "fullName", "CouncillorName", "councillorName"]) ??
    pickFirst(item, ["Surname", "surname"]);

  if (!id || !name) return null;

  return {
    id,
    name,
    party: pickFirst(item, ["Party", "party", "PoliticalParty", "politicalParty"]),
    areaName: pickFirst(item, ["WardName", "wardName", "AreaName", "areaName", "Constituency", "constituency"]),
    areaType: pickFirst(item, ["WardType", "wardType", "AreaType", "areaType"]),
    profileUrl: pickFirst(item, ["URL", "url", "ProfileUrl", "profileUrl"]),
  };
}

function extractCouncillors(parsed: any): MsLite[] {
  // ModernGov ASMX XML varies; we search for a plausible "Councillor" collection.
  const rootKeys = Object.keys(parsed ?? {});
  const root = rootKeys.length === 1 ? parsed[rootKeys[0]] : parsed;

  const candidates: any[] = [];

  const stack: any[] = [root];
  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== "object") continue;

    for (const [k, v] of Object.entries(current)) {
      if (/councillor/i.test(k) && Array.isArray(v)) candidates.push(...v);
      if (/councillor/i.test(k) && !Array.isArray(v) && typeof v === "object") candidates.push(v);
      if (typeof v === "object") stack.push(v);
    }
  }

  const items = candidates.flatMap((c) => coerceArray(c));
  const out: MsLite[] = [];
  for (const i of items) {
    const norm = normalizeCouncillor(i);
    if (norm) out.push(norm);
  }
  // De-dupe by id
  const byId = new Map<string, MsLite>();
  for (const ms of out) byId.set(ms.id, ms);
  return [...byId.values()];
}

async function callXml(db: Db, url: string) {
  const fetched = await cachedFetchText(db, { url, source: SOURCE });
  if (fetched.status < 200 || fetched.status >= 300) {
    throw new Error(`ModernGov call failed (${fetched.status})`);
  }
  const parsed = await parseStringPromise(fetched.body, {
    explicitArray: false,
    ignoreAttrs: true,
    trim: true,
    normalize: true,
  });
  return { parsed, fromCache: fetched.fromCache };
}

export async function getMsByPostcode(db: Db, postcodeRaw: string) {
  const postcode = postcodeRaw.replace(/\s+/g, "");
  const url = `${BASE}/GetCouncillorsByPostcode?sPostcode=${encodeURIComponent(postcode)}`;
  const { parsed, fromCache } = await callXml(db, url);
  return { members: extractCouncillors(parsed), fromCache, sourceUrl: url };
}

export async function getMsByWardName(db: Db, wardName: string) {
  const url = `${BASE}/GetCouncillorsByWard?sWard=${encodeURIComponent(wardName)}`;
  const { parsed, fromCache } = await callXml(db, url);
  return { members: extractCouncillors(parsed), fromCache, sourceUrl: url };
}

