import { parseStringPromise } from "xml2js";
import { getConvexClient, isConvexConfigured, localDb } from "../db";
import { api } from "../../convex/_generated/api";
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

  const toUpsert: any[] = [];

  for (const r of rows.items) {
    const memberMatch = resolveMemberForVote(args.members, r);
    if (!memberMatch) continue;

    const upsertRow = {
      meeting_id: args.meetingId,
      contribution_id: r.contributionId ?? 0,
      vote_row_id: r.voteRowId ?? undefined,
      member_id: memberMatch.memberId,
      member_uid: r.memberUid ?? undefined,
      member_name: r.memberName ?? undefined,
      occurred_at: String(rows.meetingDate ?? new Date().toISOString()),
      vote_name_en: r.voteNameEn ?? undefined,
      vote_name_cy: r.voteNameCy ?? undefined,
      vote_result_en: r.voteResultEn ?? undefined,
      vote_result_cy: r.voteResultCy ?? undefined,
      totals_for: r.totalsFor ?? undefined,
      totals_against: r.totalsAgainst ?? undefined,
      totals_abstain: r.totalsAbstain ?? undefined,
      member_result: r.memberResult || "Unknown",
      source_url: `https://record.senedd.wales/Plenary/${args.meetingId}`,
      confidence: memberMatch.confidence,
      extracted_at: now,
      last_updated_at: now,
    };

    toUpsert.push(upsertRow);
    localDb.memberVotes.set(`${args.meetingId}:${r.contributionId ?? 0}:${memberMatch.memberId}`, upsertRow);
  }

  if (toUpsert.length > 0 && isConvexConfigured()) {
    try {
      const client = getConvexClient();
      if (client) {
        await client.mutation(api.votes.upsertMany, { votes: toUpsert });
      }
    } catch {
      // Ignore Convex mutation errors
    }
  }

  return toUpsert.length;
}

function parseMeetingId(url: string): number | null {
  try {
    const u = new URL(url);
    const id = u.searchParams.get("meetingID") ?? u.searchParams.get("meetingId");
    if (id && /^\d+$/.test(id)) return Number(id);
  } catch {
    const m = /meetingID=(\d+)/i.exec(url);
    if (m) return Number(m[1]);
  }
  return null;
}

async function loadMembers() {
  const live = await fetchAllMSs();
  return live.map((m) => ({
    id: `twfy:${m.person_id}`,
    name: m.full_name || m.name,
    seneddUid: Number(m.member_id) || null,
  }));
}

type VoteRow = {
  contributionId?: number;
  voteRowId?: number;
  memberUid?: number;
  memberName?: string;
  voteNameEn?: string;
  voteNameCy?: string;
  voteResultEn?: string;
  voteResultCy?: string;
  totalsFor?: number;
  totalsAgainst?: number;
  totalsAbstain?: number;
  memberResult?: string;
};

function extractVoteRows(parsed: unknown): { meetingDate?: string; items: VoteRow[] } {
  const root = (parsed as Record<string, unknown>)?.dataroot ?? (parsed as Record<string, unknown>)?.DataRoot ?? parsed;
  const key = Object.keys(root as object ?? {}).find((k) => /XML_Votes|Votes/i.test(k));
  const rows = key ? (root as Record<string, unknown>)[key] : undefined;
  const items = coerceArray(rows).map(normalizeVoteRow).filter((r): r is VoteRow => !!r);
  const meetingDate = pickFirstText(coerceArray(rows), ["MeetingDate", "meetingDate"]);
  return { meetingDate: meetingDate ?? undefined, items };
}

function normalizeVoteRow(r: unknown): VoteRow | null {
  if (!r || typeof r !== "object") return null;
  const o = r as Record<string, unknown>;
  return {
    contributionId: numberOrUndefined(o.Contribution_ID ?? o.ContributionId ?? o.contribution_id),
    voteRowId: numberOrUndefined(o.Vote_ID ?? o.VoteID ?? o.vote_id),
    memberUid: numberOrUndefined(o.Member_ID ?? o.MemberID ?? o.member_id),
    memberName: textOrUndefined(o.Member_name_English ?? o.MemberNameEnglish ?? o.member_name_english ?? o.Member_name_Welsh),
    voteNameEn: textOrUndefined(o.Vote_title_english ?? o.VoteTitleEnglish ?? o.vote_title_english ?? o.Agenda_item_english),
    voteNameCy: textOrUndefined(o.Vote_title_welsh ?? o.VoteTitleWelsh ?? o.vote_title_welsh ?? o.Agenda_item_welsh),
    voteResultEn: textOrUndefined(o.Vote_result_english ?? o.VoteResultEnglish ?? o.vote_result_english),
    voteResultCy: textOrUndefined(o.Vote_result_welsh ?? o.VoteResultWelsh ?? o.vote_result_welsh),
    totalsFor: numberOrUndefined(o.Votes_for ?? o.VotesFor ?? o.votes_for),
    totalsAgainst: numberOrUndefined(o.Votes_against ?? o.VotesAgainst ?? o.votes_against),
    totalsAbstain: numberOrUndefined(o.Votes_abstain ?? o.VotesAbstain ?? o.votes_abstain),
    memberResult: textOrUndefined(o.Member_vote ?? o.MemberVote ?? o.member_vote ?? o.Result),
  };
}

function coerceArray<T>(v: T | T[] | undefined): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function textOrUndefined(v: unknown) {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s || undefined;
}

function numberOrUndefined(v: unknown) {
  if (v == null) return undefined;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : undefined;
}

function pickFirstText(rows: unknown[], keys: string[]): string | null {
  for (const r of rows) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    for (const k of keys) {
      const v = o[k];
      if (v != null && String(v).trim()) return String(v).trim();
    }
  }
  return null;
}

function resolveMemberForVote(
  members: Array<{ id: string; name: string; seneddUid: number | null }>,
  row: VoteRow
): { memberId: string; confidence: Confidence } | null {
  if (row.memberUid != null) {
    const byUid = members.find((m) => m.seneddUid === row.memberUid);
    if (byUid) return { memberId: byUid.id, confidence: "high" };
  }

  if (row.memberName) {
    const byName = members.find((m) => m.name.toLowerCase() === row.memberName!.toLowerCase());
    if (byName) return { memberId: byName.id, confidence: "high" };
  }

  return null;
}
