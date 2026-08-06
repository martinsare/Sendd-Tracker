/**
 * Typed API client for use in client components.
 * All functions hit Next.js API routes via relative URLs.
 */

export type SearchResult = {
  kind: "postcode" | "constituency_or_ward";
  query: string;
  members: Member[];
  areas?: { constituency: string | null; region: string | null };
  fromCache?: boolean;
  notes?: string[];
};

export type Member = {
  id: string;
  name: string;
  party?: string | null;
  areaName?: string | null;
  areaType?: string | null;
  profileUrl?: string | null;
  imageUrl?: string | null;
};

export type MemberDetail = Member & { updatedAt?: number };

export type ContributionItem = {
  id: string;
  meetingId: number;
  contributionId: number;
  speakerName: string;
  occurredAt: string;
  contextEn?: string | null;
  contextCy?: string | null;
  snippetEn: string;
  snippetCy?: string | null;
  sourceUrl: string;
  confidence: string;
};

export type VoteItem = {
  id: string;
  meetingId: number;
  contributionId: number;
  occurredAt: string;
  voteNameEn?: string | null;
  voteNameCy?: string | null;
  voteResultEn?: string | null;
  voteResultCy?: string | null;
  totalsFor?: number | null;
  totalsAgainst?: number | null;
  totalsAbstain?: number | null;
  memberResult: string;
  sourceUrl: string;
  confidence: string;
};

export type ParticipationResult = {
  memberId: string;
  memberName: string;
  totalContributions: number;
  totalVotes: number;
  topTopics: string[];
  topicBreakdown: Array<{ topic: string; count: number }>;
  page: number;
  pageSize: number;
  contributions: ContributionItem[];
  votes: VoteItem[];
};

export type AvailabilityMetric = {
  id: string;
  label: { en: string; cy: string };
  status: "available" | "partial" | "not_available";
  explanation: { en: string; cy: string };
  sourceLinks: Array<{ label: string; url: string }>;
};

export type ExportItem = {
  title: string;
  dateText?: string;
  transcriptBilingualUrl?: string;
  votesBilingualUrl?: string;
};

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export function searchMembers(q: string): Promise<SearchResult> {
  return apiFetch(`/api/search?q=${encodeURIComponent(q)}`);
}

export function getMember(id: string): Promise<MemberDetail> {
  return apiFetch(`/api/members/${encodeURIComponent(id)}`);
}

export function getMemberParticipation(
  id: string,
  opts?: { page?: number; pageSize?: number; kind?: "contributions" | "votes" }
): Promise<ParticipationResult> {
  const params = new URLSearchParams();
  if (opts?.page !== undefined) params.set("page", String(opts.page));
  if (opts?.pageSize !== undefined) params.set("pageSize", String(opts.pageSize));
  if (opts?.kind) params.set("kind", opts.kind);
  return apiFetch(`/api/members/${encodeURIComponent(id)}/participation?${params}`);
}

export function getDataAvailability(): Promise<{ metrics: AvailabilityMetric[] }> {
  return apiFetch("/api/data-availability");
}

export function getPlenaryExports(limit?: number): Promise<{ items: ExportItem[] }> {
  return apiFetch(`/api/record/plenary/exports?limit=${limit ?? 8}`);
}

export function triggerRefresh(opts?: {
  maxMeetings?: number;
  force?: boolean;
}): Promise<{ ok: boolean; contributionsInserted: number; votesRowsUpserted: number }> {
  return apiFetch("/api/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts ?? {}),
  });
}
