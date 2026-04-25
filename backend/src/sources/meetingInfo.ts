import { parseStringPromise } from "xml2js";
import type { Db } from "../db.js";
import { cachedFetchText } from "../httpCache.js";
import { env } from "../env.js";

const SOURCE = "senedd-meeting-info";
const BASE = "https://business.senedd.wales/mgwebservice.asmx";

export type Committee = {
  committeeId: number;
  committeeTitle: string;
  committeeCategory: string | null;
};

export type MeetingSummary = {
  meetingId: number;
  meetingDate: string | null; // dd/MM/yyyy
  meetingTime: string | null;
  committeeId: number | null;
  committeeTitle: string | null;
  isWebcast: boolean | null;
};

export type MeetingAttendee = {
  memberType: string | null;
  memberId: number | null;
  name: string | null;
  roleDescription: string | null;
  attendance: string | null;
  politicalParty: string | null;
  ward: string | null;
  url: string | null;
  photoSmallUrl: string | null;
  photoBigUrl: string | null;
};

export type MeetingDetail = {
  meetingId: number;
  meetingDate: string | null; // dd/MM/yyyy
  meetingTime: string | null;
  meetingLocation: string | null;
  isWebcast: boolean | null;
  attendees: MeetingAttendee[];
};

export async function listCommittees(db: Db): Promise<{ committees: Committee[]; sourceUrl: string; fromCache: boolean }> {
  const url = `${BASE}/GetCommittees?`;
  const fetched = await cachedFetchText(db, { url, source: SOURCE, ttlSeconds: env.cacheTtlSeconds });
  if (fetched.status < 200 || fetched.status >= 300) throw new Error(`Committees fetch failed (${fetched.status})`);

  const parsed = await parseStringPromise(fetched.body, { explicitArray: false, ignoreAttrs: false, trim: true, normalize: true });
  const root = parsed?.committees ?? parsed;
  const committees = coerceArray(root?.committee)
    .map((c) => {
      const id = numberOrNull(c?.committeeid);
      const title = textOrNull(c?.committeetitle);
      if (id == null || !title) return null;
      return {
        committeeId: id,
        committeeTitle: title,
        committeeCategory: textOrNull(c?.committeecategory),
      } satisfies Committee;
    })
    .filter((x): x is Committee => !!x);

  return { committees, sourceUrl: `${BASE}?op=GetCommittees`, fromCache: fetched.fromCache };
}

export async function listMeetingsByDate(
  db: Db,
  args: { committeeId: number; fromDate: string; toDate: string; ascending?: boolean },
): Promise<{ meetings: MeetingSummary[]; sourceUrl: string; fromCache: boolean }> {
  const ascending = args.ascending ?? false;
  const url =
    `${BASE}/GetAllMeetingsByDate` +
    `?lCommitteeId=${encodeURIComponent(String(args.committeeId))}` +
    `&sFromDate=${encodeURIComponent(args.fromDate)}` +
    `&sToDate=${encodeURIComponent(args.toDate)}` +
    `&bIsAscendingDateOrder=${encodeURIComponent(String(ascending))}`;

  const fetched = await cachedFetchText(db, { url, source: SOURCE, ttlSeconds: env.cacheTtlSeconds });
  if (fetched.status < 200 || fetched.status >= 300) throw new Error(`Meetings fetch failed (${fetched.status})`);

  const parsed = await parseStringPromise(fetched.body, { explicitArray: false, ignoreAttrs: false, trim: true, normalize: true });
  const root = parsed?.getmeetingsbydate ?? parsed;
  const meetings = coerceArray(root?.meetings?.meeting)
    .map((m) => {
      const meetingId = numberOrNull(m?.meetingid);
      if (meetingId == null) return null;
      return {
        meetingId,
        meetingDate: textOrNull(m?.meetingdate),
        meetingTime: textOrNull(m?.meetingtime),
        committeeId: numberOrNull(m?.committeeid),
        committeeTitle: textOrNull(m?.committeetitle),
        isWebcast: booleanOrNull(m?.iswebcast),
      } satisfies MeetingSummary;
    })
    .filter((x): x is MeetingSummary => !!x);

  return { meetings, sourceUrl: `${BASE}?op=GetAllMeetingsByDate`, fromCache: fetched.fromCache };
}

export async function getMeetingDetail(db: Db, meetingId: number): Promise<{ meeting: MeetingDetail; sourceUrl: string; fromCache: boolean }> {
  const url = `${BASE}/GetMeeting?lMeetingId=${encodeURIComponent(String(meetingId))}`;
  const fetched = await cachedFetchText(db, { url, source: SOURCE, ttlSeconds: env.cacheTtlSeconds });
  if (fetched.status < 200 || fetched.status >= 300) throw new Error(`Meeting fetch failed (${fetched.status})`);

  const parsed = await parseStringPromise(fetched.body, { explicitArray: false, ignoreAttrs: false, trim: true, normalize: true });
  const root = parsed?.meeting ?? parsed;
  const id = numberOrNull(root?.meetingid) ?? meetingId;

  const attendees = coerceArray(root?.attendees?.attendee)
    .map((a) => {
      if (!a) return null;
      const attrs = a?.$ ?? {};
      return {
        memberType: textOrNull(attrs?.membertype),
        memberId: numberOrNull(attrs?.memberid),
        name: textOrNull(attrs?.name),
        roleDescription: textOrNull(attrs?.roledescription),
        attendance: textOrNull(attrs?.attendance),
        politicalParty: textOrNull(attrs?.politicalparty),
        ward: textOrNull(attrs?.ward),
        url: textOrNull(a?.url),
        photoSmallUrl: textOrNull(a?.photosmallurl),
        photoBigUrl: textOrNull(a?.photobigurl),
      } satisfies MeetingAttendee;
    })
    .filter((x): x is MeetingAttendee => !!x);

  const meeting: MeetingDetail = {
    meetingId: id,
    meetingDate: textOrNull(root?.meetingdate),
    meetingTime: textOrNull(root?.meetingtime),
    meetingLocation: textOrNull(root?.meetinglocation),
    isWebcast: booleanOrNull(root?.iswebcast),
    attendees,
  };

  return { meeting, sourceUrl: `${BASE}?op=GetMeeting`, fromCache: fetched.fromCache };
}

export function mgDateString(d: Date) {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getUTCFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

export function parseMgDateToIso(date: string | null | undefined): string | null {
  if (!date) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date.trim());
  if (!m) return null;
  const [_, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}T00:00:00.000Z`;
}

function coerceArray<T>(v: T | T[] | undefined | null): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function textOrNull(v: any): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function numberOrNull(v: any): number | null {
  const s = textOrNull(v);
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function booleanOrNull(v: any): boolean | null {
  const s = textOrNull(v);
  if (!s) return null;
  if (s.toLowerCase() === "true") return true;
  if (s.toLowerCase() === "false") return false;
  return null;
}

