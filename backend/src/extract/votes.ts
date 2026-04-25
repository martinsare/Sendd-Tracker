import { parseStringPromise } from "xml2js";
import type { Db } from "../db.js";
import { cachedFetchText } from "../httpCache.js";
import { env } from "../env.js";
import { listRecentPlenaryExports } from "../sources/record.js";

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

export async function indexRecentPlenaryVotes(
  db: Db,
  args: { maxMeetings: number; force?: boolean },
): Promise<{ meetings: IndexedVotesMeetingResult[] }> {
  const exports = await listRecentPlenaryExports(db, Math.max(args.maxMeetings * 2, args.maxMeetings));
  const votesUrls = exports.items
    .map((i) => i.votesBilingualUrl)
    .filter((u): u is string => !!u)
    .slice(0, args.maxMeetings);

  const members = db
    .prepare(`SELECT id, name, senedd_uid as seneddUid FROM members ORDER BY updated_at DESC`)
    .all() as Array<{ id: string; name: string; seneddUid: number | null }>;

  const meetings: IndexedVotesMeetingResult[] = [];

  for (const votesUrl of votesUrls) {
    const meetingId = parseMeetingId(votesUrl);
    if (!meetingId) {
      meetings.push({
        meetingId: -1,
        votesUrl,
        parsed: false,
        rowsUpserted: 0,
        error: "Unable to parse meetingID from votes URL",
      });
      continue;
    }

    const already = db
      .prepare(
        `SELECT meeting_id as meetingId, parsed_at as parsedAt, parse_version as parseVersion
         FROM plenary_votes WHERE meeting_id = ?`,
      )
      .get(meetingId) as { meetingId: number; parsedAt: number | null; parseVersion: number } | undefined;

    const countRow = db
      .prepare(`SELECT COUNT(1) as c FROM member_votes WHERE meeting_id = ?`)
      .get(meetingId) as { c: number } | undefined;
    const hasAnyRows = (countRow?.c ?? 0) > 0;

    let shouldParse = args.force === true || !already || !already.parsedAt || already.parseVersion !== PARSE_VERSION || !hasAnyRows;
    if (!shouldParse && already?.parsedAt) shouldParse = isStale(already.parsedAt);
    if (!shouldParse) {
      meetings.push({ meetingId, votesUrl, parsed: false, rowsUpserted: 0 });
      continue;
    }

    try {
      const upserted = await parseAndStoreVotesMeeting(db, { votesUrl, meetingId, members });
      meetings.push({ meetingId, votesUrl, parsed: true, rowsUpserted: upserted });
    } catch (e: any) {
      meetings.push({ meetingId, votesUrl, parsed: false, rowsUpserted: 0, error: String(e?.message ?? e) });
    }
  }

  return { meetings };
}

async function parseAndStoreVotesMeeting(db: Db, args: { votesUrl: string; meetingId: number; members: Array<{ id: string; name: string; seneddUid: number | null }> }) {
  const fetched = await cachedFetchText(db, { url: args.votesUrl, source: VOTES_SOURCE, ttlSeconds: env.cacheTtlSeconds });
  if (fetched.status < 200 || fetched.status >= 300) throw new Error(`Votes export fetch failed (${fetched.status})`);

  const parsed = await parseStringPromise(fetched.body, { explicitArray: false, ignoreAttrs: true, trim: true, normalize: true });
  const rows = extractVoteRows(parsed);
  const now = Date.now();

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO plenary_votes(meeting_id, meeting_date, votes_url, fetched_at, parsed_at, parse_version, last_updated_at)
       VALUES(@meeting_id, @meeting_date, @votes_url, @fetched_at, @parsed_at, @parse_version, @last_updated_at)
       ON CONFLICT(meeting_id) DO UPDATE SET
         meeting_date=excluded.meeting_date,
         votes_url=excluded.votes_url,
         fetched_at=excluded.fetched_at,
         parsed_at=excluded.parsed_at,
         parse_version=excluded.parse_version,
         last_updated_at=excluded.last_updated_at`,
    ).run({
      meeting_id: args.meetingId,
      meeting_date: rows.meetingDate ?? null,
      votes_url: args.votesUrl,
      fetched_at: now,
      parsed_at: now,
      parse_version: PARSE_VERSION,
      last_updated_at: now,
    });

    const upsertStmt = db.prepare(
      `INSERT INTO member_votes(
         meeting_id, contribution_id, vote_row_id, member_id, member_uid, member_name, occurred_at,
         vote_name_en, vote_name_cy, vote_result_en, vote_result_cy,
         totals_for, totals_against, totals_abstain,
         member_result, source_url, confidence, extracted_at, last_updated_at
       )
       VALUES(
         @meeting_id, @contribution_id, @vote_row_id, @member_id, @member_uid, @member_name, @occurred_at,
         @vote_name_en, @vote_name_cy, @vote_result_en, @vote_result_cy,
         @totals_for, @totals_against, @totals_abstain,
         @member_result, @source_url, @confidence, @extracted_at, @last_updated_at
       )
       ON CONFLICT(meeting_id, contribution_id, member_id) DO UPDATE SET
         member_uid=COALESCE(member_votes.member_uid, excluded.member_uid),
         member_name=COALESCE(member_votes.member_name, excluded.member_name),
         occurred_at=excluded.occurred_at,
         vote_name_en=COALESCE(member_votes.vote_name_en, excluded.vote_name_en),
         vote_name_cy=COALESCE(member_votes.vote_name_cy, excluded.vote_name_cy),
         vote_result_en=COALESCE(member_votes.vote_result_en, excluded.vote_result_en),
         vote_result_cy=COALESCE(member_votes.vote_result_cy, excluded.vote_result_cy),
         totals_for=COALESCE(member_votes.totals_for, excluded.totals_for),
         totals_against=COALESCE(member_votes.totals_against, excluded.totals_against),
         totals_abstain=COALESCE(member_votes.totals_abstain, excluded.totals_abstain),
         member_result=excluded.member_result,
         source_url=excluded.source_url,
         confidence=excluded.confidence,
         last_updated_at=excluded.last_updated_at`,
    );

    const backfillMemberStmt = db.prepare(
      `UPDATE members
       SET
         senedd_uid = COALESCE(members.senedd_uid, @senedd_uid),
         image_url = COALESCE(members.image_url, @image_url),
         last_updated_at = @last_updated_at
       WHERE id = @id`,
    );

    let upserted = 0;

    for (const r of rows.items) {
      if (!r.memberUid && !r.memberName) continue;
      const match = resolveMemberForVote(args.members, r);
      if (!match) continue;

      if (r.memberUid) {
        backfillMemberStmt.run({
          id: match.memberId,
          senedd_uid: r.memberUid,
          image_url: `https://business.senedd.wales/mgPhoto.aspx?UID=${r.memberUid}`,
          last_updated_at: now,
        });
      }

      const result = upsertStmt.run({
        meeting_id: args.meetingId,
        contribution_id: r.contributionId ?? 0,
        vote_row_id: r.voteRowId ?? null,
        member_id: match.memberId,
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
        confidence: match.confidence,
        extracted_at: now,
        last_updated_at: now,
      });
      upserted += result.changes ?? 0;
    }

    return upserted;
  });

  return tx();
}

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

function extractVoteRows(parsed: any): { meetingDate?: string; items: VoteRow[] } {
  const root = parsed?.dataroot ?? parsed?.DataRoot ?? parsed;
  const key = Object.keys(root ?? {}).find((k) => /_Vote$/i.test(k) || /Vote/i.test(k));
  const rows = key ? root[key] : undefined;
  const items = coerceArray(rows).map((r) => normalizeVoteRow(r)).filter((r): r is VoteRow => !!r);
  const meetingDateFromAny = pickFirstText(coerceArray(rows), ["MeetingDate", "meetingDate"]);
  return { meetingDate: meetingDateFromAny ?? undefined, items };
}

function normalizeVoteRow(r: any): VoteRow | null {
  if (!r || typeof r !== "object") return null;
  const contributionId = numberOrUndefined(r.Contribution_ID ?? r.ContributionId ?? r.contribution_id);
  const voteRowId = numberOrUndefined(r.ID ?? r.Id ?? r.id);
  const memberUid = numberOrUndefined(r.Member_Id ?? r.MemberID ?? r.member_id);
  const memberName = textOrUndefined(r.Member_name_English ?? r.MemberNameEnglish ?? r.member_name_english);
  const memberResult = textOrUndefined(r.Results_Result ?? r.ResultsResult ?? r.results_result);
  const voteNameEn = textOrUndefined(r.Vote_Name_English ?? r.VoteNameEnglish ?? r.vote_name_english);
  const voteNameCy = textOrUndefined(r.Vote_Name_Welsh ?? r.VoteNameWelsh ?? r.vote_name_welsh);
  const voteResultEn = textOrUndefined(r.Vote_Result_English ?? r.VoteResultEnglish ?? r.vote_result_english);
  const voteResultCy = textOrUndefined(r.Vote_Result_Welsh ?? r.VoteResultWelsh ?? r.vote_result_welsh);
  const totalsFor = numberOrUndefined(r.VotesTotalFor ?? r.votes_total_for);
  const totalsAgainst = numberOrUndefined(r.VotesTotalAgainst ?? r.votes_total_against);
  const totalsAbstain = numberOrUndefined(r.VotesTotalAbstain ?? r.votes_total_abstain);

  return {
    contributionId,
    voteRowId,
    memberUid,
    memberName,
    memberResult,
    voteNameEn,
    voteNameCy,
    voteResultEn,
    voteResultCy,
    totalsFor,
    totalsAgainst,
    totalsAbstain,
  };
}

function resolveMemberForVote(
  members: Array<{ id: string; name: string; seneddUid: number | null }>,
  row: VoteRow,
): { memberId: string; confidence: Confidence } | null {
  if (row.memberUid) {
    const exact = members.find((m) => m.seneddUid === row.memberUid);
    if (exact) return { memberId: exact.id, confidence: "high" };
  }

  // Fallback to conservative name matching if we don't have Senedd numeric IDs yet.
  if (!row.memberName) return null;
  const best = pickBestByName(members, row.memberName);
  return best;
}

function pickBestByName(members: Array<{ id: string; name: string }>, speakerName: string): { memberId: string; confidence: Confidence } | null {
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
  let s = name;
  s = s.split("/")[0] ?? s;
  s = s.replace(/\b(AS|AC|MS|AM)\b/gi, " ");
  s = s.replace(/\(.*?\)/g, " ");
  s = s.replace(/[.'’]/g, " ");
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

function parseMeetingId(url: string): number | null {
  try {
    const u = new URL(url);
    const val = u.searchParams.get("meetingID") ?? u.searchParams.get("meetingId");
    if (!val) return null;
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function isStale(parsedAtMs: number) {
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - parsedAtMs > sevenDays;
}

function coerceArray<T>(v: T | T[] | undefined): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function textOrUndefined(v: any) {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s ? s : undefined;
}

function numberOrUndefined(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function pickFirstText(rows: any[], keys: string[]) {
  for (const r of rows) {
    for (const k of keys) {
      const v = r?.[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return undefined;
}
