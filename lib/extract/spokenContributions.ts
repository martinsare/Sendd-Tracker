import { parseStringPromise } from "xml2js";
import he from "he";
import * as cheerio from "cheerio";
import { query, transaction } from "../db";
import { cachedFetchText } from "../httpCache";
import { env } from "../env";
import { listRecentPlenaryExports } from "../sources/record";

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

  const { rows: memberRows } = await query<{ id: string; name: string; senedduid: number | null }>(
    `SELECT id, name, senedd_uid as senedduid FROM members ORDER BY updated_at DESC`
  );
  const members = memberRows.map((r) => ({ id: r.id, name: r.name, seneddUid: r.senedduid }));

  const meetings: IndexedMeetingResult[] = [];

  for (const transcriptUrl of transcriptUrls) {
    const meetingId = parseMeetingId(transcriptUrl);
    if (!meetingId) {
      meetings.push({ meetingId: -1, transcriptUrl, parsed: false, contributionsInserted: 0, error: "Unable to parse meetingID from transcript URL" });
      continue;
    }

    const { rows: existingRows } = await query<{ meetingid: number; parsedat: string | null; parseversion: number }>(
      `SELECT meeting_id as meetingid, parsed_at as parsedat, parse_version as parseversion FROM plenary_transcripts WHERE meeting_id = $1`,
      [meetingId]
    );
    const already = existingRows[0];

    const { rows: countRows } = await query<{ c: string }>(
      `SELECT COUNT(1) as c FROM spoken_contributions WHERE meeting_id = $1`, [meetingId]
    );
    const hasAny = Number(countRows[0]?.c ?? 0) > 0;

    const { rows: missingRows } = await query<{ c: string }>(
      `SELECT COUNT(1) as c FROM spoken_contributions WHERE meeting_id = $1 AND (full_text_en IS NULL OR full_text_en = '') AND (full_text_cy IS NULL OR full_text_cy = '')`,
      [meetingId]
    );
    const hasMissingFullText = Number(missingRows[0]?.c ?? 0) > 0;

    let shouldParse =
      args.force === true ||
      !already ||
      !already.parsedat ||
      already.parseversion !== PARSE_VERSION ||
      !hasAny ||
      hasMissingFullText;

    if (!shouldParse && already?.parsedat) shouldParse = isStale(Number(already.parsedat));
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
    const { rows } = await query<{ transcripturl: string }>(
      `SELECT transcript_url as transcripturl FROM plenary_transcripts WHERE meeting_id = $1`, [args.meetingId]
    );
    transcriptUrl = rows[0]?.transcripturl ?? `https://record.senedd.wales/XMLExport/Download?meetingID=${args.meetingId}&xmlDownloadType=BilingualTranscript`;
  }

  const { rows: memberRows } = await query<{ id: string; name: string }>(
    `SELECT id, name FROM members ORDER BY updated_at DESC`
  );

  const upserted = await parseAndStoreMeeting({
    transcriptUrl,
    meetingId: args.meetingId,
    members: memberRows,
    maxContributions: args.maxContributionsPerMeeting ?? 1500,
  });

  return { ok: true, contributionsUpserted: upserted, transcriptUrl };
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

  return transaction(async (client) => {
    await client.query(
      `INSERT INTO plenary_transcripts(meeting_id, meeting_date, transcript_url, fetched_at, parsed_at, parse_version, last_updated_at)
       VALUES($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT(meeting_id) DO UPDATE SET
         meeting_date=EXCLUDED.meeting_date, transcript_url=EXCLUDED.transcript_url,
         fetched_at=EXCLUDED.fetched_at, parsed_at=EXCLUDED.parsed_at,
         parse_version=EXCLUDED.parse_version, last_updated_at=EXCLUDED.last_updated_at`,
      [args.meetingId, rows.meetingDate ?? null, args.transcriptUrl, now, now, PARSE_VERSION, now]
    );

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

      // Backfill Senedd UID from transcript data
      if (r.memberUid) {
        await client.query(
          `UPDATE members SET senedd_uid=COALESCE(senedd_uid, $1), last_updated_at=$2 WHERE id=$3`,
          [r.memberUid, now, match.memberId]
        );
      }

      const sourceUrl = `https://record.senedd.wales/Plenary/${args.meetingId}`;
      const result = await client.query(
        `INSERT INTO spoken_contributions(
           meeting_id, contribution_id, member_id, speaker_name, occurred_at, context_en, context_cy,
           snippet_en, snippet_cy, full_text_en, full_text_cy, source_url, confidence, extracted_at, last_updated_at
         ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT(meeting_id, contribution_id, member_id) DO UPDATE SET
           speaker_name=EXCLUDED.speaker_name, occurred_at=EXCLUDED.occurred_at,
           context_en=COALESCE(spoken_contributions.context_en, EXCLUDED.context_en),
           context_cy=COALESCE(spoken_contributions.context_cy, EXCLUDED.context_cy),
           snippet_en=CASE WHEN spoken_contributions.snippet_en IS NULL OR spoken_contributions.snippet_en='' THEN EXCLUDED.snippet_en ELSE spoken_contributions.snippet_en END,
           snippet_cy=COALESCE(spoken_contributions.snippet_cy, EXCLUDED.snippet_cy),
           full_text_en=COALESCE(spoken_contributions.full_text_en, EXCLUDED.full_text_en),
           full_text_cy=COALESCE(spoken_contributions.full_text_cy, EXCLUDED.full_text_cy),
           source_url=EXCLUDED.source_url, confidence=EXCLUDED.confidence, last_updated_at=EXCLUDED.last_updated_at`,
        [
          args.meetingId, r.contributionId ?? processed, match.memberId, r.speakerName,
          rows.meetingDate ?? new Date().toISOString(),
          r.contextEn ?? null, r.contextCy ?? null,
          content.snippetEn ?? content.snippetCy ?? "",
          content.snippetCy ?? null,
          content.fullTextEn ?? null, content.fullTextCy ?? null,
          sourceUrl, match.confidence, now, now,
        ]
      );
      inserted += result.rowCount ?? 0;
    }

    return inserted;
  });
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
