export type SearchResponse = {
  kind: "postcode" | "constituency_or_ward";
  query: string;
  members: Array<{
    id: string;
    name: string;
    party?: string;
    areaName?: string;
    areaType?: string;
    profileUrl?: string;
    imageUrl?: string;
  }>;
  sourceUrl: string;
  fromCache: boolean;
};

export type MemberTerm = {
  house: string; // e.g. "Senedd Cymru", "UK Parliament"
  constituency?: string;
  party?: string;
  startYear?: string;
  endYear?: string;
  isCurrent: boolean;
};

export type MemberResponse = {
  id: string;
  name: string;
  party: string | null;
  areaName: string | null;
  areaType: string | null;
  profileUrl: string | null;
  imageUrl: string | null;
  updatedAt: number;
  history?: {
    tenureSummary?: string;
    firstElectedYear?: string;
    terms: MemberTerm[];
  };
};

export type DataAvailabilityResponse = {
  metrics: Array<{
    id: string;
    label: { en: string; cy: string };
    status: "available" | "partial" | "not_available";
    explanation: { en: string; cy: string };
    sourceLinks: Array<{ label: string; url: string }>;
  }>;
};

export type PlenaryExportsResponse = {
  items: Array<{
    title: string;
    dateText?: string;
    transcriptBilingualUrl?: string;
    transcriptWelshUrl?: string;
    transcriptEnglishUrl?: string;
    votesBilingualUrl?: string;
  }>;
  fromCache: boolean;
  sourceUrl: string;
};

export type ParticipationResponse = {
  memberId: string;
  lastUpdatedAt: string | null;
  real: {
    implemented: boolean;
    partial: boolean;
    items: ParticipationItem[];
    dataNotes: string[];
    topicClassificationNote: string;
  };
  summary: {
    totalContributions: number;
    contributionsLast30Days: number;
    mostActiveMonth: string;
    topTopics: string[];
    topicBreakdown: Array<{ topic: string; count: number }>;
    activityLevel: "Low" | "Moderate" | "High";
  };
  committees?: {
    implemented: boolean;
    partial: boolean;
    daysBack: number;
    totalMeetingsFound: number;
  };
};

export type ParticipationItem = {
  id: string;
  kind: "speech" | "vote" | "committee" | "question" | "motion";
  occurredAt: string;
  title: string;
  contextEn?: string;
  contextCy?: string;
  snippetEn: string;
  snippetCy?: string;
  topics?: string[];
  primaryTopic?: string | null;
  sourceUrl: string;
  confidence: "high" | "medium" | "low";
  committee?: {
    committeeId: number | null;
    committeeTitle: string | null;
    attendance: string;
    meetingLocation: string | null;
    isWebcast: boolean | null;
  };
  vote?: {
    memberResult: "for" | "against" | "abstain" | "did_not_vote" | null;
    memberResultRaw: string;
    overallEn: string | null;
    overallCy: string | null;
    totals: { for: number; against: number; abstain: number } | null;
  };
};

export type SpokenContributionDetail = {
  meetingId: number;
  contributionId: number;
  memberId: string;
  speakerName: string;
  occurredAt: string;
  contextEn: string | null;
  contextCy: string | null;
  snippetEn: string;
  snippetCy: string | null;
  fullTextEn: string | null;
  fullTextCy: string | null;
  sourceUrl: string;
  confidence: "high" | "medium" | "low";
  transcriptXmlUrl: string | null;
  recordPageUrl: string;
};

export type DebateItem = {
  gid: string;
  hdate: string;
  htime?: string;
  body: string;
  epheading?: string;
  listurl?: string;
};

export type DebatesResponse = {
  query: string;
  total_results: number;
  debates: DebateItem[];
  sourceUrl: string;
  fromCache: boolean;
};

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`API error (${res.status})`);
  return (await res.json()) as T;
}

export function search(q: string) {
  return apiGet<SearchResponse>(`/api/search?q=${encodeURIComponent(q)}`);
}

export function getDataAvailability() {
  return apiGet<DataAvailabilityResponse>(`/api/data-availability`);
}

export function getRecentPlenaryExports(limit = 8) {
  return apiGet<PlenaryExportsResponse>(`/api/record/plenary/exports?limit=${limit}`);
}

export function getMemberParticipation(memberId: string) {
  return apiGet<ParticipationResponse>(`/api/members/${encodeURIComponent(memberId)}/participation`);
}

export function getMember(memberId: string) {
  return apiGet<MemberResponse>(`/api/members/${encodeURIComponent(memberId)}`);
}

export function refreshData(args?: { maxMeetings?: number; force?: boolean }) {
  return fetch(`/api/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(args ?? {}),
  }).then(async (res) => {
    if (!res.ok) throw new Error(`API error (${res.status})`);
    return (await res.json()) as {
      ok: boolean;
      startedAt: string;
      finishedAt: string;
      maxMeetings: number;
      force: boolean;
      contributionsInserted: number;
    };
  });
}

export function getSpokenContributionDetail(args: { meetingId: number; contributionId: number; memberId?: string }) {
  const q = args.memberId ? `?memberId=${encodeURIComponent(args.memberId)}` : "";
  return apiGet<SpokenContributionDetail>(`/api/spoken/${args.meetingId}/${args.contributionId}${q}`);
}

export function getDebates(args?: { q?: string; personId?: string; page?: number; num?: number }) {
  const params = new URLSearchParams();
  if (args?.q) params.set("q", args.q);
  if (args?.personId) params.set("personId", args.personId);
  if (args?.page) params.set("page", String(args.page));
  if (args?.num) params.set("num", String(args.num));
  const qs = params.toString() ? `?${params.toString()}` : "";
  return apiGet<DebatesResponse>(`/api/debates${qs}`);
}
