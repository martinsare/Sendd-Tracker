import { parseStringPromise } from "xml2js";
import he from "he";
import * as cheerio from "cheerio";
import type { Db } from "../db.js";
import { cachedFetchText } from "../httpCache.js";
import { env } from "../env.js";
import { listRecentPlenaryExports } from "../sources/record.js";

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

export async function indexRecentPlenarySpokenContributions(
  db: Db,
  args: { maxMeetings: number; maxContributionsPerMeeting?: number; force?: boolean },
): Promise<{ meetings: IndexedMeetingResult[] }> {
  const exports = await listRecentPlenaryExports(db, Math.max(args.maxMeetings * 2, args.maxMeetings));
  const transcriptUrls = exports.items
    .map((i) => i.transcriptBilingualUrl ?? i.transcriptEnglishUrl ?? i.transcriptWelshUrl)
    .filter((u): u is string => !!u)
    .slice(0, args.maxMeetings);

  const members = db
    .prepare(`SELECT id, name FROM members ORDER BY updated_at DESC`)
    .all() as Array<{ id: string; name: string }>;

  const meetings: IndexedMeetingResult[] = [];

  for (const transcriptUrl of transcriptUrls) {
    const meetingId = parseMeetingId(transcriptUrl);
    if (!meetingId) {
      meetings.push({
        meetingId: -1,
        transcriptUrl,
        parsed: false,
        contributionsInserted: 0,
        error: "Unable to parse meetingID from transcript URL",
      });
      continue;
    }

    const already = db
      .prepare(
        `SELECT meeting_id as meetingId, parsed_at as parsedAt, parse_version as parseVersion
         FROM plenary_transcripts WHERE meeting_id = ?`,
      )
      .get(meetingId) as { meetingId: number; parsedAt: number | null; parseVersion: number } | undefined;

    const countRow = db
      .prepare(`SELECT COUNT(1) as c FROM spoken_contributions WHERE meeting_id = ?`)
      .get(meetingId) as { c: number } | undefined;
    const hasAnyContributions = (countRow?.c ?? 0) > 0;

    const missingFullTextRow = db
      .prepare(
        `SELECT COUNT(1) as c
         FROM spoken_contributions
         WHERE meeting_id = ?
           AND (full_text_en IS NULL OR full_text_en = '')
           AND (full_text_cy IS NULL OR full_text_cy = '')`,
      )
      .get(meetingId) as { c: number } | undefined;
    const hasMissingFullText = (missingFullTextRow?.c ?? 0) > 0;

    let shouldParse =
      args.force === true ||
      !already ||
      !already.parsedAt ||
      already.parseVersion !== PARSE_VERSION ||
      !hasAnyContributions ||
      hasMissingFullText;

    if (!shouldParse && already?.parsedAt) {
      shouldParse = isStale(already.parsedAt);
    }
    if (!shouldParse) {
      meetings.push({ meetingId, transcriptUrl, parsed: false, contributionsInserted: 0 });
      continue;
    }

    try {
      const inserted = await parseAndStoreMeeting(db, {
        transcriptUrl,
        meetingId,
        members,
        maxContributions: args.maxContributionsPerMeeting ?? 1500,
      });
      meetings.push({ meetingId, transcriptUrl, parsed: true, contributionsInserted: inserted });
    } catch (e: any) {
      meetings.push({
        meetingId,
        transcriptUrl,
        parsed: false,
        contributionsInserted: 0,
        error: String(e?.message ?? e),
      });
    }
  }

  return { meetings };
}

export async function backfillPlenaryMeetingSpokenContributions(
  db: Db,
  args: { meetingId: number; transcriptUrl?: string; maxContributionsPerMeeting?: number },
): Promise<{ ok: boolean; contributionsUpserted: number; transcriptUrl: string }> {
  const transcriptUrl =
    args.transcriptUrl ??
    (db.prepare(`SELECT transcript_url as transcriptUrl FROM plenary_transcripts WHERE meeting_id = ?`).get(args.meetingId) as
      | { transcriptUrl: string }
      | undefined)?.transcriptUrl ??
    `https://record.senedd.wales/XMLExport/Download?meetingID=${args.meetingId}&xmlDownloadType=BilingualTranscript`;

  const members = db
    .prepare(`SELECT id, name FROM members ORDER BY updated_at DESC`)
    .all() as Array<{ id: string; name: string }>;

  const upserted = await parseAndStoreMeeting(db, {
    transcriptUrl,
    meetingId: args.meetingId,
    members,
    maxContributions: args.maxContributionsPerMeeting ?? 1500,
  });

  return { ok: true, contributionsUpserted: upserted, transcriptUrl };
}

async function parseAndStoreMeeting(
  db: Db,
  args: { transcriptUrl: string; meetingId: number; members: Array<{ id: string; name: string }>; maxContributions: number },
) {
  const fetched = await cachedFetchText(db, { url: args.transcriptUrl, source: TRANSCRIPT_SOURCE, ttlSeconds: env.cacheTtlSeconds });
  if (fetched.status < 200 || fetched.status >= 300) throw new Error(`Transcript fetch failed (${fetched.status})`);

  const xml = stripBom(fetched.body);
  const parsed = await parseStringPromise(xml, { explicitArray: false, ignoreAttrs: true, trim: true, normalize: true });
  const rows = extractRows(parsed);

  const now = Date.now();
  const extractedAt = now;

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO plenary_transcripts(meeting_id, meeting_date, transcript_url, fetched_at, parsed_at, parse_version, last_updated_at)
       VALUES(@meeting_id, @meeting_date, @transcript_url, @fetched_at, @parsed_at, @parse_version, @last_updated_at)
       ON CONFLICT(meeting_id) DO UPDATE SET
         meeting_date=excluded.meeting_date,
         transcript_url=excluded.transcript_url,
         fetched_at=excluded.fetched_at,
         parsed_at=excluded.parsed_at,
         parse_version=excluded.parse_version,
         last_updated_at=excluded.last_updated_at`,
    ).run({
      meeting_id: args.meetingId,
      meeting_date: rows.meetingDate ?? null,
      transcript_url: args.transcriptUrl,
      fetched_at: now,
      parsed_at: now,
      parse_version: PARSE_VERSION,
      last_updated_at: now,
    });

    const insertStmt = db.prepare(
      `INSERT INTO spoken_contributions(
         meeting_id, contribution_id, member_id, speaker_name, occurred_at, context_en, context_cy,
         snippet_en, snippet_cy, full_text_en, full_text_cy, source_url, confidence, extracted_at, last_updated_at
       )
       VALUES(
         @meeting_id, @contribution_id, @member_id, @speaker_name, @occurred_at, @context_en, @context_cy,
         @snippet_en, @snippet_cy, @full_text_en, @full_text_cy, @source_url, @confidence, @extracted_at, @last_updated_at
       )
       ON CONFLICT(meeting_id, contribution_id, member_id) DO UPDATE SET
         speaker_name=excluded.speaker_name,
         occurred_at=excluded.occurred_at,
         context_en=COALESCE(spoken_contributions.context_en, excluded.context_en),
         context_cy=COALESCE(spoken_contributions.context_cy, excluded.context_cy),
         snippet_en=CASE
           WHEN spoken_contributions.snippet_en IS NULL OR spoken_contributions.snippet_en = '' THEN excluded.snippet_en
           ELSE spoken_contributions.snippet_en
         END,
         snippet_cy=COALESCE(spoken_contributions.snippet_cy, excluded.snippet_cy),
         full_text_en=COALESCE(spoken_contributions.full_text_en, excluded.full_text_en),
         full_text_cy=COALESCE(spoken_contributions.full_text_cy, excluded.full_text_cy),
         source_url=excluded.source_url,
         confidence=excluded.confidence,
         last_updated_at=excluded.last_updated_at`,
    );

    const backfillMemberStmt = db.prepare(
      `UPDATE members
       SET
         senedd_uid = COALESCE(members.senedd_uid, @senedd_uid),
         profile_url = COALESCE(members.profile_url, @profile_url),
         image_url = COALESCE(members.image_url, @image_url),
         last_updated_at = @last_updated_at
       WHERE id = @id`,
    );

    let inserted = 0;
    let processed = 0;

    for (const r of rows.items) {
      processed++;
      if (processed > args.maxContributions) break;

      if (!r.speakerName) continue;
      const speaker = normalizeSpeakerName(r.speakerName);
      if (!speaker) continue;

      const content = extractTextContent({
        verbatimHtml: r.verbatimHtml,
        translatedHtml: r.translatedHtml,
        contributionLanguage: r.contributionLanguage,
      });
      if (!content.fullTextCy && !content.fullTextEn) continue;

      const match = pickBestMemberMatch(args.members, speaker);
      if (!match) continue;

      // Best-effort: store the Senedd numeric member id + official profile URL when present in the export.
      if (r.memberUid || r.memberBioEnglish) {
        backfillMemberStmt.run({
          id: match.memberId,
          senedd_uid: r.memberUid ?? null,
          profile_url: r.memberBioEnglish ?? null,
          image_url: r.memberUid ? `https://business.senedd.wales/mgPhoto.aspx?UID=${r.memberUid}` : null,
          last_updated_at: extractedAt,
        });
      }

      const sourceUrl = r.seneddTvSpokenUrl ?? args.transcriptUrl;

      const result = insertStmt.run({
        meeting_id: args.meetingId,
        contribution_id: r.contributionId ?? 0,
        member_id: match.memberId,
        speaker_name: r.speakerName,
        occurred_at: rows.meetingDate ?? new Date().toISOString(),
        context_en: r.contextEn ?? null,
        context_cy: r.contextCy ?? null,
        snippet_en: content.snippetEn ?? content.snippetCy ?? "",
        snippet_cy: content.snippetCy ?? null,
        full_text_en: content.fullTextEn ?? null,
        full_text_cy: content.fullTextCy ?? null,
        source_url: sourceUrl,
        confidence: match.confidence,
        extracted_at: extractedAt,
        last_updated_at: extractedAt,
      });

      // `changes` can be 1 for inserts and updates. We treat this as "upserted rows" for reporting purposes.
      inserted += result.changes ?? 0;
    }

    return inserted;
  });

  return tx();
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

function stripBom(text: string) {
  if (!text) return text;
  // Remove UTF-8 BOM if present.
  return text.replace(/^\uFEFF/, "");
}

type TranscriptRow = {
  contributionId?: number;
  contributionLanguage?: string;
  speakerName?: string;
  memberUid?: number;
  memberBioEnglish?: string;
  contextEn?: string;
  contextCy?: string;
  verbatimHtml?: string;
  translatedHtml?: string;
  seneddTvSpokenUrl?: string;
};

function extractRows(parsed: any): { meetingDate?: string; items: TranscriptRow[] } {
  const root = parsed?.dataroot ?? parsed?.DataRoot ?? parsed;
  // Bilingual transcripts have this node name; keep it robust in case it changes.
  const key = Object.keys(root ?? {}).find((k) => /XML_Plenary/i.test(k));
  const rows = key ? root[key] : undefined;
  const items = coerceArray(rows).map((r) => normalizeRow(r)).filter((r): r is TranscriptRow => !!r);
  // MeetingDate is repeated in each row; pull from root if available.
  const meetingDateFromAny = pickFirstText(coerceArray(rows), ["MeetingDate", "meetingDate"]);
  return { meetingDate: meetingDateFromAny ?? undefined, items };
}

function normalizeRow(r: any): TranscriptRow | null {
  if (!r || typeof r !== "object") return null;
  const contributionId = numberOrUndefined(r.Contribution_ID ?? r.ContributionId ?? r.contribution_id);
  const contributionLanguage = textOrUndefined(r.contribution_language ?? r.ContributionLanguage ?? r.Contribution_Language);
  const speakerName = textOrUndefined(r.Member_name_English ?? r.MemberNameEnglish ?? r.member_name_english);
  const memberUid = numberOrUndefined(r.Member_Id ?? r.MemberID ?? r.member_id);
  const memberBioEnglish = textOrUndefined(r.Member_biog_English ?? r.MemberBiogEnglish ?? r.member_biog_english);
  const contextEn = textOrUndefined(r.Agenda_item_english ?? r.AgendaItemEnglish ?? r.agenda_item_english);
  const contextCy = textOrUndefined(r.Agenda_item_welsh ?? r.AgendaItemWelsh ?? r.agenda_item_welsh);
  const verbatimHtml = textOrUndefined(r.contribution_verbatim ?? r.ContributionVerbatim ?? r.Contribution_Verbatim);
  const translatedHtml = textOrUndefined(r.contribution_translated ?? r.ContributionTranslated ?? r.Contribution_Translated);
  const seneddTvSpokenUrl = textOrUndefined(r.contribution_spoken_seneddTv ?? r.contribution_spoken_seneddtv ?? r.ContributionSpoken);

  return {
    contributionId,
    contributionLanguage,
    speakerName,
    memberUid,
    memberBioEnglish,
    contextEn,
    contextCy,
    verbatimHtml,
    translatedHtml,
    seneddTvSpokenUrl,
  };
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

function normalizeSpeakerName(name: string) {
  // Keep original diacritics; normalisation happens in tokenisation.
  return name.trim();
}

function tokenizeForMatch(name: string) {
  let s = name;
  // Remove bilingual label after slash, and member suffixes (AS/AC).
  s = s.split("/")[0] ?? s;
  s = s.replace(/\b(AS|AC|MS|AM)\b/gi, " ");
  s = s.replace(/\(.*?\)/g, " ");
  s = s.replace(/[.'’]/g, " ");
  s = s.replace(/[^\p{L}\p{N}\s-]/gu, " ");
  s = s.replace(/\s+/g, " ").trim().toLowerCase();
  const tokens = s.split(" ").filter(Boolean);
  const coreTokens = tokens.filter((t) => t.length > 1);
  return { tokens, coreTokens, key: coreTokens.join(" "), first: coreTokens[0], last: coreTokens[coreTokens.length - 1] };
}

function pickBestMemberMatch(members: Array<{ id: string; name: string }>, speakerName: string): { memberId: string; confidence: Confidence } | null {
  const speaker = tokenizeForMatch(speakerName);
  if (!speaker.key || !speaker.last) return null;

  const scored = members
    .map((m) => ({ id: m.id, score: scoreMatch(speakerName, m.name) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return null;
  const best = scored[0];
  const second = scored[1];
  if (second && Math.abs(best.score - second.score) < 0.05 && best.score < 1.0) {
    // Ambiguous: avoid misattribution.
    return null;
  }

  const confidence: Confidence = best.score >= 0.95 ? "high" : best.score >= 0.8 ? "medium" : "low";
  return { memberId: best.id, confidence };
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

function extractTextContent(args: { verbatimHtml?: string; translatedHtml?: string; contributionLanguage?: string }) {
  const verbatimPlain = htmlEncodedToPlain(args.verbatimHtml);
  const translatedPlain = htmlEncodedToPlain(args.translatedHtml);

  // In bilingual transcripts, verbatim is the spoken language; translated is the other language.
  // We do not auto-translate; we only use the official translated text if present.
  const lang = (args.contributionLanguage ?? "").toLowerCase();
  let snippetEn: string | undefined;
  let snippetCy: string | undefined;
  let fullTextEn: string | undefined;
  let fullTextCy: string | undefined;

  if (lang === "cy") {
    fullTextCy = verbatimPlain;
    fullTextEn = translatedPlain;
    snippetCy = snippet(fullTextCy);
    snippetEn = snippet(fullTextEn);
  } else if (lang === "en") {
    fullTextEn = verbatimPlain;
    fullTextCy = translatedPlain;
    snippetEn = snippet(fullTextEn);
    snippetCy = snippet(fullTextCy);
  } else {
    // Fallback: prefer translated as English and verbatim as Welsh (common case), but keep it best-effort.
    fullTextCy = verbatimPlain;
    fullTextEn = translatedPlain;
    snippetCy = snippet(fullTextCy);
    snippetEn = snippet(fullTextEn);
  }

  return { snippetCy, snippetEn, fullTextCy, fullTextEn };
}

function htmlEncodedToPlain(htmlEncoded: string | undefined): string | undefined {
  if (!htmlEncoded) return undefined;
  const decoded = he.decode(htmlEncoded);
  const $ = cheerio.load(decoded);
  const text = $.text().replace(/\s+/g, " ").trim();
  return text ? text : undefined;
}

function snippet(text: string | undefined) {
  if (!text) return undefined;
  const max = 280;
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
