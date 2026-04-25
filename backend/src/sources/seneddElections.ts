import { parseStringPromise } from "xml2js";
import type { Db } from "../db.js";
import { cachedFetchText } from "../httpCache.js";
import { env } from "../env.js";

const SOURCE = "senedd-election-results";
const BASE = "https://business.senedd.wales/mgwebservice.asmx/GetElectionResults";

export type ElectedMember = {
  term: string; // e.g. "6"
  name: string;
  party?: string;
  areaName: string;
  areaType: "Constituency" | "Region";
  sourceUrl: string;
};

// IDs observed on the Senedd ModernGov service:
// - 18: Senedd Election (Constituency) 2021
// - 19: Senedd Election (Regional) 2021
const SIXTH_SENEDD_TERM = "6";
const CONSTITUENCY_ELECTION_ID = 18;
const REGIONAL_ELECTION_ID = 19;

export async function fetchSixthSeneddElectedMembers(db: Db): Promise<{ members: ElectedMember[]; sources: string[] }> {
  const constituency = await fetchElection(db, CONSTITUENCY_ELECTION_ID, "Constituency");
  const regional = await fetchElection(db, REGIONAL_ELECTION_ID, "Region");
  return { members: [...constituency, ...regional], sources: [`${BASE}?lElectionId=${CONSTITUENCY_ELECTION_ID}`, `${BASE}?lElectionId=${REGIONAL_ELECTION_ID}`] };
}

async function fetchElection(db: Db, electionId: number, areaType: "Constituency" | "Region"): Promise<ElectedMember[]> {
  const url = `${BASE}?lElectionId=${electionId}`;
  const fetched = await cachedFetchText(db, { url, source: SOURCE, ttlSeconds: env.cacheTtlSeconds });
  if (fetched.status < 200 || fetched.status >= 300) throw new Error(`Election results fetch failed (${fetched.status})`);

  const parsed = await parseStringPromise(fetched.body, { explicitArray: false, ignoreAttrs: true, trim: true, normalize: true });
  const election = parsed?.election ?? parsed;
  const candidates = election?.candidates?.candidate ?? [];
  const list = Array.isArray(candidates) ? candidates : [candidates];

  const out: ElectedMember[] = [];
  for (const c of list) {
    if (!c) continue;
    const isElected = String(c.iselected ?? "").toLowerCase() === "true";
    if (!isElected) continue;
    const name = String(c.candidatename ?? "").trim();
    const areaName = String(c.areatitle ?? "").trim();
    if (!name || !areaName) continue;
    const party = String(c.politicalpartytitle ?? "").trim() || undefined;
    out.push({
      term: SIXTH_SENEDD_TERM,
      name,
      party,
      areaName,
      areaType,
      sourceUrl: url,
    });
  }

  return out;
}

