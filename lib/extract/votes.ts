import { parseStringPromise } from "xml2js";
import { supabase } from "../db";
import { cachedFetchText } from "../httpCache";
import { env } from "../env";
import { listRecentPlenaryExports } from "../sources/record";
import { fetchAllMSs } from "../sources/twfy";

export type Confidence = "high" | "medium" | "low";

export type IndexedVotesMeetingResult = {
  meetingId: number;
  votesUrl: string;
  parsed: boolean;
  rowsUpserted: number;
  error?: string;
};

const VOTES_SOURCE = "senedd-record-votes";
const PARSE_VERSION = 1;

export async function indexRecentPlenaryVotes(args: {
  maxMeetings: number;
  force?: boolean;
}): Promise<{ meetings: IndexedVotesMeetingResult[] }> {
  const exports = await listRecentPlenaryExports(Math.max(args.maxMeetings * 2, args.maxMeetings));
  const votesUrls = exports.items
    .map((i) => i.votesBilingualUrl)
    .filter((u): u is string => !!u)
    .slice(0, args.maxMeetings);

  const members = await loadMembers();

  const meetings: IndexedVotesMeetingResult[] = [];

  for (const votesUrl of votesUrls) {
    const meetingId = parseMeetingId(votesUrl);
    if (!meetingId) {
      meetings.push({ meetingId: -1, votesUrl, parsed: false, rowsUpserted: 0, error: "Unable to parse meetingID from votes URL" });
      continue;
    }

    const [{ data: existingRows }, { count: countRows }] = await Promise.all([
      supabase().from("plenary_votes").select("parsed_at,parse_version").eq("meeting_id", meetingId).limit(1),
      supabase().from("member_votes").select("meeting_id", { count: "exact", head: true }).eq("meeting_id", meetingId),
    ]);
    const already = existingRows?.[0] as { parsed_at?: string | null; parse_version?: number | null } | undefined;
    const hasAny = Number(countRows ?? 0) > 0;

    let shouldParse = args.force === true || !already || !already.parsed_at || already.parse_version !== PARSE_VERSION || !hasAny;
    if (!shouldParse && already?.parsed_at) shouldParse = isStale(Number(already.parsed_at));
    if (!shouldParse) {
      meetings.push({ meetingId, votesUrl, parsed: false, rowsUpserted: 0 });
      continue;
    }

    try {
      const upserted = await parseAndStoreVotesMeeting({ votesUrl, meetingId, members });
      meetings.push({ meetingId, votesUrl, parsed: true, rowsUpserted: upserted });
    } catch (e: unknown) {
      meetings.push({ meetingId, votesUrl, parsed: false, rowsUpserted: 0, error: String((e as Error)?.message ?? e) });
    }
  }

  return { meetings };
}

async function parseAndStoreVotesMeeting(args: {
  votesUrl: string;
  meetingId: number;
  members: Array<{ id: string; name: string; seneddUid: number | null }>;
}): Promise<number> {
  const fetched = await cachedFetchText({ url: args.votesUrl, source: VOTES_SOURCE, ttlSeconds: env.cacheTtlSeconds });
  if (fetched.status < 200 || fetched.status >= 300)
    throw new Error(`Votes export fetch failed (${fetched.status})`);

  const parsed = await parseStringPromise(fetched.body, { explicitArray: false, ignoreAttrs: true, trim: true, normalize: true });
  const rows = extractVoteRows(parsed);
  const now = Date.now();

  const db = supabase() as any;
  await db.from("plenary_votes").upsert({
    meeting_id: args.meetingId,
    meeting_date: rows.meetingDate ?? null,
    votes_url: args.votesUrl,
    fetched_at: now,
    parsed_at: now,
    parse_version: PARSE_VERSION,
    last_updated_at: now,
  });

  let upserted = 0;

  for (const r of rows.items) {
    const memberMatch = resolveMemberForVote(args.members, r);
    if (!memberMatch) continue;

    const { error } = await db.from("member_votes").upsert(
      {
        meeting_id: args.meetingId,
        contribution_id: r.contributionId ?? 0,
        vote_row_id: r.voteRowId ?? null,
        member_id: memberMatch.memberId,
        member_uid: r.memberUid ?? null,
        member_name: r.memberName ?? null,
        occurred_at: rows.meetingDate ?? new Date().toISOString(),
        vote_name_en: r.voteNameEn ?? null,
        vote_name_cy: r.voteNameCy ?? null,
        vote_result_en: r.voteResultEn ?? null,
        vote_result_cy: r.voteResultCy ?? null,
        totals_for: r.totalsFor ?? null,
        totals_against: r.totalsAgainst ?? null,
        totals_abstain: r.totalsAbstain ?? null,
        member_result: r.memberResult ?? "Unknown",
        source_url: `https://record.senedd.wales/Plenary/${args.meetingId}`,
        confidence: memberMatch.confidence,
        extracted_at: now,
        last_updated_at: now,
      },
      { onConflict: "meeting_id,contribution_id,member_id" }
    );
    if (!error) upserted++;
  }

  return upserted;
}

async function loadMembers(): Promise<Array<{ id: string; name: string; seneddUid: number | null }>> {
  const { data } = await supabase()
    .from("members")
    .select("id,name,senedd_uid")
    .order("updated_at", { ascending: false });
  const cached = ((data ?? []) as any[]).map((r) => ({ id: r.id, name: r.name, seneddUid: r.senedd_uid ?? null }));
  if (cached.length) return cached;

  const live = await fetchAllMSs();
  return live.map((m) => ({
    id: `twfy:${m.person_id}`,
    name: m.full_name || m.name,
    seneddUid: Number(m.member_id) || null,
  }));
}

// ─── XML parsing ─────────────────────────────────────────────────────────────

type VoteRow = {
  contributionId?: number;
  voteRowId?: number;
  memberUid?: number;
  memberName?: string;
  memberResult?: string;
  voteNameEn?: string;
  voteNameCy?: string;
  voteResultEn?: string;
  voteResultCy?: string;
  totalsFor?: number;
  totalsAgainst?: number;
  totalsAbstain?: number;
};

function extractVoteRows(parsed: unknown): { meetingDate?: string; items: VoteRow[] } {
  const root = (parsed as Record<string, unknown>)?.dataroot ?? (parsed as Record<string, unknown>)?.DataRoot ?? parsed;
  const key = Object.keys(root as object ?? {}).find((k) => /XML_Votes/i.test(k) || /Vote/i.test(k));
  const rows = key ? (root as Record<string, unknown>)[key] : undefined;
  const items = coerceArray(rows).map(normalizeVoteRow).filter((r): r is VoteRow => !!r);
  const meetingDateFromAny = pickFirstText(coerceArray(rows), ["MeetingDate", "meetingDate"]);
  return { meetingDate: meetingDateFromAny ?? undefined, items };
}

function normalizeVoteRow(r: unknown): VoteRow | null {
  if (!r || typeof r !== "object") return null;
  const o = r as Record<string, unknown>;
  return {
    contributionId: numberOrUndefined(o.Contribution_ID ?? o.ContributionId ?? o.contribution_id),
    voteRowId: numberOrUndefined(o.ID ?? o.Id ?? o.id),
    memberUid: numberOrUndefined(o.Member_Id ?? o.MemberID ?? o.member_id),
    memberName: textOrUndefined(o.Member_name_English ?? o.MemberNameEnglish ?? o.member_name_english),
    memberResult: textOrUndefined(o.Results_Result ?? o.ResultsResult ?? o.results_result),
    voteNameEn: textOrUndefined(o.Vote_Name_English ?? o.VoteNameEnglish ?? o.vote_name_english),
    voteNameCy: textOrUndefined(o.Vote_Name_Welsh ?? o.VoteNameWelsh ?? o.vote_name_welsh),
    voteResultEn: textOrUndefined(o.Vote_Result_English ?? o.VoteResultEnglish ?? o.vote_result_english),
    voteResultCy: textOrUndefined(o.Vote_Result_Welsh ?? o.VoteResultWelsh ?? o.vote_result_welsh),
    totalsFor: numberOrUndefined(o.VotesTotalFor ?? o.votes_total_for),
    totalsAgainst: numberOrUndefined(o.VotesTotalAgainst ?? o.votes_total_against),
    totalsAbstain: numberOrUndefined(o.VotesTotalAbstain ?? o.votes_total_abstain),
  };
}

function resolveMemberForVote(
  members: Array<{ id: string; name: string; seneddUid: number | null }>,
  row: VoteRow
): { memberId: string; confidence: Confidence } | null {
  if (row.memberUid) {
    const exact = members.find((m) => m.seneddUid === row.memberUid);
    if (exact) return { memberId: exact.id, confidence: "high" };
  }
  if (!row.memberName) return null;
  return pickBestByName(members, row.memberName);
}

function pickBestByName(
  members: Array<{ id: string; name: string }>,
  speakerName: string
): { memberId: string; confidence: Confidence } | null {
  const scored = members
    .map((m) => ({ id: m.id, score: scoreMatch(speakerName, m.name) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!scored.length) return null;
  const best = scored[0];
  const second = scored[1];
  if (second && Math.abs(best.score - second.score) < 0.05 && best.score < 1.0) return null;
  const confidence: Confidence = best.score >= 0.95 ? "high" : best.score >= 0.8 ? "medium" : "low";
  return { memberId: best.id, confidence };
}

function scoreMatch(aName: string, bName: string) {
  const a = tokenizeForMatch(aName);
  const b = tokenizeForMatch(bName);
  if (!a.key || !b.key) return 0;
  if (a.key === b.key) return 1.0;
  if (a.last && b.last && a.last === b.last && a.first && b.first && a.first === b.first) return 0.85;
  if (a.last && b.last && a.last === b.last && a.first && b.first && a.first[0] === b.first[0]) return 0.75;
  const overlap = jaccard(a.coreTokens, b.coreTokens);
  if (a.last && b.last && a.last === b.last && overlap >= 0.6) return 0.65;
  return 0;
}

function tokenizeForMatch(name: string) {
  let s = name.split("/")[0] ?? name;
  s = s.replace(/\b(AS|AC|MS|AM)\b/gi, " ");
  s = s.replace(/\(.*?\)/g, " ");
  s = s.replace(/[.'']/g, " ");
  s = s.replace(/[^\p{L}\p{N}\s-]/gu, " ");
  s = s.replace(/\s+/g, " ").trim().toLowerCase();
  const tokens = s.split(" ").filter(Boolean);
  const coreTokens = tokens.filter((t) => t.length > 1);
  return { coreTokens, key: coreTokens.join(" "), first: coreTokens[0], last: coreTokens[coreTokens.length - 1] };
}

function jaccard(a: string[], b: string[]) {
  const A = new Set(a);
  const B = new Set(b);
  const inter = [...A].filter((x) => B.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : inter / union;
}

function isStale(parsedAtMs: number) {
  return Date.now() - parsedAtMs > 7 * 24 * 60 * 60 * 1000;
}

function parseMeetingId(url: string): number | null {
  try {
    const u = new URL(url);
    const val = u.searchParams.get("meetingID") ?? u.searchParams.get("meetingId");
    if (!val) return null;
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
  } catch { return null; }
}

function coerceArray<T>(v: T | T[] | undefined): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function textOrUndefined(v: unknown) {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s || undefined;
}

function numberOrUndefined(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function pickFirstText(rows: unknown[], keys: string[]) {
  for (const r of rows) {
    for (const k of keys) {
      const v = (r as Record<string, unknown>)?.[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return undefined;
}
