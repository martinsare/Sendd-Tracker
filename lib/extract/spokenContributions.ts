import { parseStringPromise } from "xml2js";
import he from "he";
import * as cheerio from "cheerio";
import { supabase } from "../db";
import { cachedFetchText } from "../httpCache";
import { env } from "../env";
import { listRecentPlenaryExports } from "../sources/record";
import { fetchAllMSs } from "../sources/twfy";

export type Confidence = "high" | "medium" | "low";

export type IndexedMeetingResult = {
  meetingId: number;
  transcriptUrl: string;
  parsed: boolean;
  contributionsInserted: number;
  error?: string;
};

const TRANSCRIPT_SOURCE = "senedd-record-transcript";
const PARSE_VERSION = 3;

export async function indexRecentPlenarySpokenContributions(args: {
  maxMeetings: number;
  maxContributionsPerMeeting?: number;
  force?: boolean;
}): Promise<{ meetings: IndexedMeetingResult[] }> {
  const exports = await listRecentPlenaryExports(Math.max(args.maxMeetings * 2, args.maxMeetings));
  const transcriptUrls = exports.items
    .map((i) => i.transcriptBilingualUrl ?? i.transcriptEnglishUrl ?? i.transcriptWelshUrl)
    .filter((u): u is string => !!u)
    .slice(0, args.maxMeetings);

  const members = await loadMembers();

  const meetings: IndexedMeetingResult[] = [];

  for (const transcriptUrl of transcriptUrls) {
    const meetingId = parseMeetingId(transcriptUrl);
    if (!meetingId) {
      meetings.push({ meetingId: -1, transcriptUrl, parsed: false, contributionsInserted: 0, error: "Unable to parse meetingID from transcript URL" });
      continue;
    }

    const [{ data: existingRows }, { data: countRows }, { data: missingRows }] = await Promise.all([
      supabase()
        .from("plenary_transcripts")
        .select("meeting_id,parsed_at,parse_version")
        .eq("meeting_id", meetingId)
        .limit(1),
      supabase()
        .from("spoken_contributions")
        .select("meeting_id", { count: "exact", head: true })
        .eq("meeting_id", meetingId),
      supabase()
        .from("spoken_contributions")
        .select("meeting_id", { count: "exact", head: true })
        .eq("meeting_id", meetingId)
        .is("full_text_en", null)
        .is("full_text_cy", null),
    ]);
    const already = existingRows?.[0] as { parsed_at?: string | null; parse_version?: number | null } | undefined;
    const hasAny = Number(countRows ?? 0) > 0;
    const hasMissingFullText = Number(missingRows ?? 0) > 0;

    let shouldParse =
      args.force === true ||
      !already ||
      !already.parsed_at ||
      already.parse_version !== PARSE_VERSION ||
      !hasAny ||
      hasMissingFullText;

    if (!shouldParse && already?.parsed_at) shouldParse = isStale(Number(already.parsed_at));
    if (!shouldParse) {
      meetings.push({ meetingId, transcriptUrl, parsed: false, contributionsInserted: 0 });
      continue;
    }

    try {
      const inserted = await parseAndStoreMeeting({
        transcriptUrl, meetingId,
        members: members.map((m) => ({ id: m.id, name: m.name })),
        maxContributions: args.maxContributionsPerMeeting ?? 1500,
      });
      meetings.push({ meetingId, transcriptUrl, parsed: true, contributionsInserted: inserted });
    } catch (e: unknown) {
      meetings.push({ meetingId, transcriptUrl, parsed: false, contributionsInserted: 0, error: String((e as Error)?.message ?? e) });
    }
  }

  return { meetings };
}

export async function backfillPlenaryMeetingSpokenContributions(args: {
  meetingId: number;
  transcriptUrl?: string;
  maxContributionsPerMeeting?: number;
}): Promise<{ ok: boolean; contributionsUpserted: number; transcriptUrl: string }> {
  let transcriptUrl = args.transcriptUrl;
  if (!transcriptUrl) {
    const { data } = await supabase()
      .from("plenary_transcripts")
      .select("transcript_url")
      .eq("meeting_id", args.meetingId)
      .maybeSingle();
    transcriptUrl =
      (data as any)?.transcript_url ??
      `https://record.senedd.wales/XMLExport/Download?meetingID=${args.meetingId}&xmlDownloadType=BilingualTranscript`;
  }

    const memberRows = await loadMembers();

  const upserted = await parseAndStoreMeeting({
    transcriptUrl: transcriptUrl as string,
    meetingId: args.meetingId,
    members: memberRows,
    maxContributions: args.maxContributionsPerMeeting ?? 1500,
  });

  return { ok: true, contributionsUpserted: upserted, transcriptUrl: transcriptUrl as string };
}

async function parseAndStoreMeeting(args: {
  transcriptUrl: string;
  meetingId: number;
  members: Array<{ id: string; name: string }>;
  maxContributions: number;
}): Promise<number> {
  const fetched = await cachedFetchText({ url: args.transcriptUrl, source: TRANSCRIPT_SOURCE, ttlSeconds: env.cacheTtlSeconds });
  if (fetched.status < 200 || fetched.status >= 300)
    throw new Error(`Transcript fetch failed (${fetched.status})`);

  const xml = stripBom(fetched.body);
  const parsed = await parseStringPromise(xml, { explicitArray: false, ignoreAttrs: true, trim: true, normalize: true });
  const rows = extractRows(parsed);
  const now = Date.now();

  const db = supabase() as any;
  await db.from("plenary_transcripts").upsert({
    meeting_id: args.meetingId,
    meeting_date: rows.meetingDate ?? null,
    transcript_url: args.transcriptUrl,
    fetched_at: now,
    parsed_at: now,
    parse_version: PARSE_VERSION,
    last_updated_at: now,
  });

  let inserted = 0;
  let processed = 0;

  for (const r of rows.items) {
    processed++;
    if (processed > args.maxContributions) break;
    if (!r.speakerName) continue;
    const speaker = r.speakerName.trim();
    if (!speaker) continue;

    const content = extractTextContent({
      verbatimHtml: r.verbatimHtml,
      translatedHtml: r.translatedHtml,
      contributionLanguage: r.contributionLanguage,
    });
    if (!content.fullTextCy && !content.fullTextEn) continue;

    const match = pickBestMemberMatch(args.members, speaker);
    if (!match) continue;

    if (r.memberUid) {
      await db.from("members").update({ senedd_uid: r.memberUid, last_updated_at: now }).eq("id", match.memberId);
    }

    const sourceUrl = `https://record.senedd.wales/Plenary/${args.meetingId}`;
    const upsertRow = {
      meeting_id: args.meetingId,
      contribution_id: r.contributionId ?? processed,
      member_id: match.memberId,
      speaker_name: r.speakerName ?? speaker,
      occurred_at: String(rows.meetingDate ?? new Date().toISOString()),
      context_en: r.contextEn ?? null,
      context_cy: r.contextCy ?? null,
      snippet_en: content.snippetEn ?? content.snippetCy ?? "",
      snippet_cy: content.snippetCy ?? null,
      full_text_en: content.fullTextEn ?? null,
      full_text_cy: content.fullTextCy ?? null,
      source_url: sourceUrl,
      confidence: match.confidence,
      extracted_at: now,
      last_updated_at: now,
    };

    const { error } = await db.from("spoken_contributions").upsert(upsertRow, {
      onConflict: "meeting_id,contribution_id,member_id",
    });
    if (!error) inserted++;
  }

  return inserted;
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

// ─── XML parsing helpers ─────────────────────────────────────────────────────

type TranscriptRow = {
  contributionId?: number;
  contributionLanguage?: string;
  speakerName?: string;
  memberUid?: number;
  contextEn?: string;
  contextCy?: string;
  verbatimHtml?: string;
  translatedHtml?: string;
};

function extractRows(parsed: unknown): { meetingDate?: string; items: TranscriptRow[] } {
  const root = (parsed as Record<string, unknown>)?.dataroot ?? (parsed as Record<string, unknown>)?.DataRoot ?? parsed;
  const key = Object.keys(root as object ?? {}).find((k) => /XML_Plenary/i.test(k));
  const rows = key ? (root as Record<string, unknown>)[key] : undefined;
  const items = coerceArray(rows).map(normalizeRow).filter((r): r is TranscriptRow => !!r);
  const meetingDateFromAny = pickFirstText(coerceArray(rows), ["MeetingDate", "meetingDate"]);
  return { meetingDate: meetingDateFromAny ?? undefined, items };
}

function normalizeRow(r: unknown): TranscriptRow | null {
  if (!r || typeof r !== "object") return null;
  const o = r as Record<string, unknown>;
  return {
    contributionId: numberOrUndefined(o.Contribution_ID ?? o.ContributionId ?? o.contribution_id),
    contributionLanguage: textOrUndefined(o.contribution_language ?? o.ContributionLanguage ?? o.Contribution_Language),
    speakerName: textOrUndefined(o.Member_name_English ?? o.MemberNameEnglish ?? o.member_name_english),
    memberUid: numberOrUndefined(o.Member_Id ?? o.MemberID ?? o.member_id),
    contextEn: textOrUndefined(o.Agenda_item_english ?? o.AgendaItemEnglish ?? o.agenda_item_english),
    contextCy: textOrUndefined(o.Agenda_item_welsh ?? o.AgendaItemWelsh ?? o.agenda_item_welsh),
    verbatimHtml: textOrUndefined(o.contribution_verbatim ?? o.ContributionVerbatim ?? o.Contribution_Verbatim),
    translatedHtml: textOrUndefined(o.contribution_translated ?? o.ContributionTranslated ?? o.Contribution_Translated),
  };
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

function stripBom(text: string) {
  return text.replace(/^\uFEFF/, "");
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

function extractTextContent(args: { verbatimHtml?: string; translatedHtml?: string; contributionLanguage?: string }) {
  const verbatimPlain = htmlEncodedToPlain(args.verbatimHtml);
  const translatedPlain = htmlEncodedToPlain(args.translatedHtml);
  const lang = (args.contributionLanguage ?? "").toLowerCase();

  if (lang === "cy") {
    return { fullTextCy: verbatimPlain, fullTextEn: translatedPlain, snippetCy: snippet(verbatimPlain), snippetEn: snippet(translatedPlain) };
  } else if (lang === "en") {
    return { fullTextEn: verbatimPlain, fullTextCy: translatedPlain, snippetEn: snippet(verbatimPlain), snippetCy: snippet(translatedPlain) };
  } else {
    return { fullTextCy: verbatimPlain, fullTextEn: translatedPlain, snippetCy: snippet(verbatimPlain), snippetEn: snippet(translatedPlain) };
  }
}

function htmlEncodedToPlain(htmlEncoded: string | undefined): string | undefined {
  if (!htmlEncoded) return undefined;
  const decoded = he.decode(htmlEncoded);
  const $ = cheerio.load(decoded);
  const text = $.text().replace(/\s+/g, " ").trim();
  return text || undefined;
}

function snippet(text: string | undefined) {
  if (!text) return undefined;
  return text.length <= 280 ? text : `${text.slice(0, 279)}…`;
}

// ─── Member matching ─────────────────────────────────────────────────────────

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

function scoreMatch(speakerName: string, memberName: string) {
  const a = tokenizeForMatch(speakerName);
  const b = tokenizeForMatch(memberName);
  if (!a.key || !b.key) return 0;
  if (a.key === b.key) return 1.0;
  if (a.last && b.last && a.last === b.last && a.first && b.first && a.first === b.first) return 0.85;
  if (a.last && b.last && a.last === b.last && a.first && b.first && a.first[0] === b.first[0]) return 0.75;
  const overlap = jaccard(a.coreTokens, b.coreTokens);
  if (a.last && b.last && a.last === b.last && overlap >= 0.6) return 0.65;
  return 0;
}

function jaccard(a: string[], b: string[]) {
  const A = new Set(a);
  const B = new Set(b);
  const inter = [...A].filter((x) => B.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : inter / union;
}

function pickBestMemberMatch(
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
