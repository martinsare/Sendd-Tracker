import { parseStringPromise } from "xml2js";
import { query, transaction } from "../db";
import { cachedFetchText } from "../httpCache";
import { env } from "../env";
import { listRecentPlenaryExports } from "../sources/record";

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

  const { rows: memberRows } = await query<{ id: string; name: string; senedduid: number | null }>(
    `SELECT id, name, senedd_uid as senedduid FROM members ORDER BY updated_at DESC`
  );
  const members = memberRows.map((r) => ({ id: r.id, name: r.name, seneddUid: r.senedduid }));

  const meetings: IndexedVotesMeetingResult[] = [];

  for (const votesUrl of votesUrls) {
    const meetingId = parseMeetingId(votesUrl);
    if (!meetingId) {
      meetings.push({ meetingId: -1, votesUrl, parsed: false, rowsUpserted: 0, error: "Unable to parse meetingID from votes URL" });
      continue;
    }

    const { rows: existingRows } = await query<{ parsedat: string | null; parseversion: number }>(
      `SELECT parsed_at as parsedat, parse_version as parseversion FROM plenary_votes WHERE meeting_id = $1`, [meetingId]
    );
    const already = existingRows[0];

    const { rows: countRows } = await query<{ c: string }>(
      `SELECT COUNT(1) as c FROM member_votes WHERE meeting_id = $1`, [meetingId]
    );
    const hasAny = Number(countRows[0]?.c ?? 0) > 0;

    let shouldParse = args.force === true || !already || !already.parsedat || already.parseversion !== PARSE_VERSION || !hasAny;
    if (!shouldParse && already?.parsedat) shouldParse = isStale(Number(already.parsedat));
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

  return transaction(async (client) => {
    await client.query(
      `INSERT INTO plenary_votes(meeting_id, meeting_date, votes_url, fetched_at, parsed_at, parse_version, last_updated_at)
       VALUES($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT(meeting_id) DO UPDATE SET
         meeting_date=EXCLUDED.meeting_date, votes_url=EXCLUDED.votes_url,
         fetched_at=EXCLUDED.fetched_at, parsed_at=EXCLUDED.parsed_at,
         parse_version=EXCLUDED.parse_version, last_updated_at=EXCLUDED.last_updated_at`,
      [args.meetingId, rows.meetingDate ?? null, args.votesUrl, now, now, PARSE_VERSION, now]
    );

    let upserted = 0;

    for (const r of rows.items) {
      const memberMatch = resolveMemberForVote(args.members, r);
      if (!memberMatch) continue;

      const result = await client.query(
        `INSERT INTO member_votes(
           meeting_id, contribution_id, vote_row_id, member_id, member_uid, member_name, occurred_at,
           vote_name_en, vote_name_cy, vote_result_en, vote_result_cy,
           totals_for, totals_against, totals_abstain,
           member_result, source_url, confidence, extracted_at, last_updated_at
         ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
         ON CONFLICT(meeting_id, contribution_id, member_id) DO UPDATE SET
           member_uid=COALESCE(member_votes.member_uid, EXCLUDED.member_uid),
           occurred_at=EXCLUDED.occurred_at,
           vote_name_en=COALESCE(member_votes.vote_name_en, EXCLUDED.vote_name_en),
           vote_name_cy=COALESCE(member_votes.vote_name_cy, EXCLUDED.vote_name_cy),
           vote_result_en=COALESCE(member_votes.vote_result_en, EXCLUDED.vote_result_en),
           vote_result_cy=COALESCE(member_votes.vote_result_cy, EXCLUDED.vote_result_cy),
           totals_for=COALESCE(member_votes.totals_for, EXCLUDED.totals_for),
           totals_against=COALESCE(member_votes.totals_against, EXCLUDED.totals_against),
           totals_abstain=COALESCE(member_votes.totals_abstain, EXCLUDED.totals_abstain),
           member_result=EXCLUDED.member_result, last_updated_at=EXCLUDED.last_updated_at`,
        [
          args.meetingId, r.contributionId ?? 0, r.voteRowId ?? null,
          memberMatch.memberId, r.memberUid ?? null, r.memberName ?? null,
          rows.meetingDate ?? new Date().toISOString(),
          r.voteNameEn ?? null, r.voteNameCy ?? null,
          r.voteResultEn ?? null, r.voteResultCy ?? null,
          r.totalsFor ?? null, r.totalsAgainst ?? null, r.totalsAbstain ?? null,
          r.memberResult ?? "Unknown",
          `https://record.senedd.wales/Plenary/${args.meetingId}`,
          memberMatch.confidence, now, now,
        ]
      );
      upserted += result.rowCount ?? 0;
    }

    return upserted;
  });
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
