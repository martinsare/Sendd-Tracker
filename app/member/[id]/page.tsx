"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useI18n } from "@/contexts/I18nContext";
import { LoadingSpinner } from "@/components/Logo";
import { useToast } from "@/contexts/ToastContext";
import { MemberAvatar } from "@/components/MemberAvatar";
import * as api from "@/lib/api";

type MsLite = api.SearchResponse["members"][number];
type MemberTab = "overview" | "contributions" | "votes" | "history" | "sources";
type VoteFilter =
  "cast" | "all" | "for" | "against" | "abstain" | "did_not_vote";

function tabFromHash(hash: string): MemberTab {
  const h = (hash || "").replace(/^#/, "").trim().toLowerCase();
  if (h === "contributions" || h === "speeches") return "contributions";
  if (h === "votes") return "votes";
  if (h === "history" || h === "career" || h === "terms") return "history";
  if (h === "sources") return "sources";
  return "overview";
}

function getPartyColor(party: string | null | undefined): string {
  if (!party) return "var(--text3)";
  const p = party.toLowerCase();
  if (p.includes("plaid")) return "#008142"; // Plaid Cymru Green
  if (p.includes("labour") || p.includes("llafur")) return "#dc241f"; // Labour Red
  if (p.includes("conservative") || p.includes("ceidwadol")) return "#0087dc"; // Tory Blue
  if (p.includes("liberal") || p.includes("democrat")) return "#faa61a"; // Lib Dem Gold
  if (p.includes("reform")) return "#12b6cf"; // Reform Cyan
  if (p.includes("green") || p.includes("gwyrdd")) return "#6ab023"; // Green
  return "var(--text2)";
}

function BackIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function RefreshIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ animation: spinning ? "spin 1s linear infinite" : undefined }}
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso || "—";
  }
}

function tryGetMeetingIdFromUrl(url: string): number | null {
  try {
    const u = new URL(url);
    const id =
      u.searchParams.get("meetingID") ?? u.searchParams.get("meetingId");
    if (id && /^\d+$/.test(id)) return Number(id);
    const parts = u.pathname.split("/").filter(Boolean);
    for (const p of parts.reverse()) {
      if (/^\d+$/.test(p)) return Number(p);
    }
    return null;
  } catch {
    return null;
  }
}

function recordPageUrl(meetingId: number) {
  return `https://record.senedd.wales/Plenary/${meetingId}`;
}

function isSeneddTvUrl(url: string) {
  try {
    return new URL(url).hostname.toLowerCase().includes("senedd.tv");
  } catch {
    return false;
  }
}

interface VoteParsed {
  memberResult: "for" | "against" | "abstain" | "did_not_vote" | null;
  overall: string | null;
  totals: { for: number; against: number; abstain: number } | null;
}

function parseVoteFromItem(
  it: api.ParticipationItem,
  lang: "en" | "cy"
): VoteParsed {
  if (it.vote) {
    const overall =
      (lang === "cy" ? it.vote.overallCy : it.vote.overallEn) ??
      it.vote.overallEn ??
      it.vote.overallCy ??
      null;
    return {
      memberResult: it.vote.memberResult,
      overall,
      totals: it.vote.totals,
    };
  }
  const snippet = (lang === "cy" ? it.snippetCy : it.snippetEn) ?? it.snippetEn;
  if (!snippet) return { memberResult: null, overall: null, totals: null };
  const memberMatch = /member result:\s*(for|against|abstain)/i.exec(snippet);
  const overallMatch = /overall:\s*([^.]+)/i.exec(snippet);
  const totalsMatch =
    /totals:\s*for\s+(\d+)[,\s]+against\s+(\d+)[,\s]+abstain\s+(\d+)/i.exec(
      snippet
    );
  return {
    memberResult: memberMatch
      ? (memberMatch[1].toLowerCase() as VoteParsed["memberResult"])
      : null,
    overall: overallMatch ? overallMatch[1].trim() : null,
    totals: totalsMatch
      ? {
          for: parseInt(totalsMatch[1], 10),
          against: parseInt(totalsMatch[2], 10),
          abstain: parseInt(totalsMatch[3], 10),
        }
      : null,
  };
}

export default function MemberPage() {
  const params = useParams();
  const id =
    typeof params?.id === "string"
      ? params.id
      : Array.isArray(params?.id)
        ? params.id[0]
        : undefined;
  const { lang, t } = useI18n();
  const toast = useToast();

  const [tab, setTab] = useState<MemberTab>(() =>
    tabFromHash(typeof window === "undefined" ? "" : window.location.hash)
  );
  const [voteFilter, setVoteFilter] = useState<VoteFilter>("all");
  const [topicQuery, setTopicQuery] = useState("");
  const [selectedTopicKey, setSelectedTopicKey] = useState<string | null>(null);

  const [memberDetail, setMemberDetail] = useState<api.MemberResponse | null>(
    null
  );
  const [exports, setExports] = useState<api.PlenaryExportsResponse | null>(
    null
  );
  const [availability, setAvailability] =
    useState<api.DataAvailabilityResponse | null>(null);
  const [participation, setParticipation] =
    useState<api.ParticipationResponse | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const [readerOpen, setReaderOpen] = useState(false);
  const [readerLoading, setReaderLoading] = useState(false);
  const [readerError, setReaderError] = useState<string | null>(null);
  const [readerDetail, setReaderDetail] =
    useState<api.SpokenContributionDetail | null>(null);
  const [readerLang, setReaderLang] = useState<"en" | "cy">("en");

  const member: MsLite | null = useMemo(() => {
    if (!id || typeof window === "undefined") return null;
    const raw = sessionStorage.getItem(`member:${id}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as MsLite;
    } catch {
      return null;
    }
  }, [id]);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (!id) return;
    api
      .getMember(id)
      .then(setMemberDetail)
      .catch(() => setMemberDetail(null));
    setLoadingData(true);
    Promise.all([
      api
        .getRecentPlenaryExports(8)
        .then(setExports)
        .catch(() => setExports(null)),
      api
        .getDataAvailability()
        .then(setAvailability)
        .catch(() => setAvailability(null)),
      api
        .getMemberParticipation(id)
        .then(setParticipation)
        .catch(() => setParticipation(null)),
    ]).finally(() => setLoadingData(false));
  }, [id]);

  const setActiveTab = (next: MemberTab) => {
    setTab(next);
    if (typeof window !== "undefined")
      window.location.hash = next === "overview" ? "overview" : next;
  };

  const realContributions = useMemo(() => {
    return (
      participation?.real?.items?.filter(
        (i) =>
          i.kind === "speech" || i.kind === "question" || i.kind === "motion"
      ) ?? []
    );
  }, [participation]);

  const realVotes = useMemo(() => {
    return participation?.real?.items?.filter((i) => i.kind === "vote") ?? [];
  }, [participation]);

  const committeeMeetings = useMemo(() => {
    return (
      participation?.real?.items?.filter((i) => i.kind === "committee") ?? []
    );
  }, [participation]);

  const memberName = member?.name ?? memberDetail?.name ?? null;
  const memberParty = member?.party ?? memberDetail?.party ?? null;
  const memberAreaName = member?.areaName ?? memberDetail?.areaName ?? null;
  const memberProfileUrl =
    member?.profileUrl ?? memberDetail?.profileUrl ?? null;
  const memberImageUrl = member?.imageUrl ?? memberDetail?.imageUrl ?? null;
  const partyColor = getPartyColor(memberParty);

  const openSpeechReader = async (it: api.ParticipationItem) => {
    if (!id) return;
    const match = /^spoken:(\d+):(\d+)$/.exec(it.id);
    if (!match) {
      toast.show(t("full_text_unavailable"), "error");
      return;
    }
    const meetingIdFromId = Number(match[1]);
    const contributionId = Number(match[2]);
    setReaderLang(lang);
    setReaderOpen(true);
    setReaderLoading(true);
    setReaderError(null);
    setReaderDetail(null);
    try {
      const detail = await api.getSpokenContributionDetail({
        meetingId: meetingIdFromId,
        contributionId,
        memberId: id,
      });
      setReaderDetail(detail);
    } catch (e: unknown) {
      setReaderError(String((e as Error)?.message ?? e));
    } finally {
      setReaderLoading(false);
    }
  };

  const topicsForUi = useMemo(() => {
    const byTopic = new Map<string, api.ParticipationItem[]>();
    const other: api.ParticipationItem[] = [];
    for (const it of realContributions) {
      const key = (it.primaryTopic ?? "").trim();
      if (!key) {
        other.push(it);
        continue;
      }
      const arr = byTopic.get(key) ?? [];
      arr.push(it);
      byTopic.set(key, arr);
    }
    const breakdown = participation?.summary?.topicBreakdown ?? [];
    const counts = new Map(breakdown.map((b) => [b.topic, b.count] as const));
    const orderedKeys = breakdown.map((b) => b.topic);
    const seen = new Set<string>();
    const out: Array<{
      key: string;
      count: number;
      items: api.ParticipationItem[];
    }> = [];
    for (const key of orderedKeys) {
      const items = (byTopic.get(key) ?? [])
        .slice()
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
      if (items.length === 0) continue;
      out.push({ key, count: counts.get(key) ?? items.length, items });
      seen.add(key);
    }
    for (const [key, itemsRaw] of byTopic.entries()) {
      if (seen.has(key)) continue;
      const items = itemsRaw
        .slice()
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
      out.push({ key, count: items.length, items });
    }
    if (other.length) {
      const items = other
        .slice()
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
      out.push({ key: "__other__", count: items.length, items });
    }
    return out;
  }, [participation?.summary?.topicBreakdown, realContributions]);

  const filteredTopics = useMemo(() => {
    const q = topicQuery.trim().toLowerCase();
    if (!q) return topicsForUi;
    return topicsForUi.filter((x) =>
      (x.key === "__other__" ? t("topic_other") : x.key)
        .toLowerCase()
        .includes(q)
    );
  }, [topicQuery, topicsForUi, t]);

  useEffect(() => {
    if (!filteredTopics.length) {
      setSelectedTopicKey(null);
      return;
    }
    if (
      selectedTopicKey &&
      filteredTopics.some((x) => x.key === selectedTopicKey)
    )
      return;
    setSelectedTopicKey(filteredTopics[0].key);
  }, [filteredTopics, selectedTopicKey]);

  const selectedTopic = selectedTopicKey
    ? (filteredTopics.find((x) => x.key === selectedTopicKey) ?? null)
    : null;
  const selectedTopicLabel =
    selectedTopic?.key === "__other__"
      ? t("topic_other")
      : (selectedTopic?.key ?? "");

  const latestContributionDate = useMemo(() => {
    if (!realContributions.length) return null;
    const sorted = realContributions
      .slice()
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    return formatDate(sorted[0].occurredAt);
  }, [realContributions]);

  const topTopicName = useMemo(() => {
    if (participation?.summary?.topTopics?.length) {
      return participation.summary.topTopics[0];
    }
    if (topicsForUi.length && topicsForUi[0].key !== "__other__") {
      return topicsForUi[0].key;
    }
    return null;
  }, [participation?.summary?.topTopics, topicsForUi]);

  const filteredVotes = useMemo(() => {
    const items = realVotes
      .slice()
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    if (voteFilter === "all") return items;
    if (voteFilter === "cast") {
      return items.filter((v) => {
        const r = parseVoteFromItem(v, lang).memberResult;
        return r === "for" || r === "against" || r === "abstain";
      });
    }
    return items.filter(
      (v) => parseVoteFromItem(v, lang).memberResult === voteFilter
    );
  }, [lang, realVotes, voteFilter]);

  const voteCounts = useMemo(() => {
    const c = {
      all: realVotes.length,
      cast: 0,
      for: 0,
      against: 0,
      abstain: 0,
      did_not_vote: 0,
    };
    for (const v of realVotes) {
      const r = parseVoteFromItem(v, lang).memberResult;
      if (r === "for") c.for++;
      if (r === "against") c.against++;
      if (r === "abstain") c.abstain++;
      if (r === "did_not_vote") c.did_not_vote++;
    }
    c.cast = c.for + c.against + c.abstain;
    return c;
  }, [lang, realVotes]);

  if (!id) return null;

  return (
    <div className="page-wrapper">
      {/* Member Hero Header */}
      <section className="member-hero">
        <div className="container">
          <div className="member-hero__back">
            <Link href="/" className="btn btn--ghost btn--sm">
              <BackIcon /> {t("nav_home")}
            </Link>
            <div className="row row--8">
              <button
                className="btn btn--ghost btn--sm"
                disabled={refreshing}
                onClick={async () => {
                  setRefreshError(null);
                  setRefreshing(true);
                  try {
                    await api.refreshData({ maxMeetings: 20, force: false });
                    if (id)
                      setParticipation(await api.getMemberParticipation(id));
                    setExports(await api.getRecentPlenaryExports(8));
                    toast.show(t("refresh_success"), "ok");
                  } catch (e: unknown) {
                    const msg = String((e as Error)?.message ?? e);
                    setRefreshError(msg);
                    toast.show(msg, "error");
                  } finally {
                    setRefreshing(false);
                  }
                }}
                type="button"
                title={t("refresh_data")}
              >
                <RefreshIcon spinning={refreshing} />{" "}
                {refreshing ? t("refreshing") : t("refresh_data")}
              </button>

              <button
                className="btn btn--ghost btn--sm share-btn"
                onClick={() => {
                  navigator.clipboard
                    .writeText(window.location.href)
                    .then(() => toast.show(t("copied"), "ok"));
                }}
                title={t("copy_link")}
                type="button"
              >
                <ShareIcon /> {t("copy_link")}
              </button>
            </div>
          </div>

          {refreshError && (
            <div
              className="alert alert--danger text-sm"
              style={{ marginBottom: 16 }}
            >
              {refreshError}
            </div>
          )}

          {memberName ? (
            <div className="member-hero__profile">
              <div
                className="member-avatar-wrapper"
                style={{ borderColor: partyColor }}
              >
                <MemberAvatar
                  name={memberName}
                  imageUrl={memberImageUrl}
                  size={76}
                />
              </div>
              <div className="member-hero__details">
                <h1 className="member-hero__name">{memberName}</h1>
                <div className="member-hero__meta">
                  {memberParty && (
                    <span className="party-badge" style={{ color: partyColor }}>
                      <span className="party-dot" />
                      {memberParty}
                    </span>
                  )}
                  {memberAreaName && (
                    <span className="badge badge--neutral">
                      {memberAreaName}
                    </span>
                  )}
                  <span className="badge badge--live">
                    <span className="badge-live-pulse" />
                    Senedd Plenary Record
                  </span>
                  {memberDetail?.history?.tenureSummary && (
                    <span
                      className="badge badge--neutral"
                      style={{ cursor: "pointer" }}
                      onClick={() => setActiveTab("history")}
                      title="Click to view parliamentary career history"
                    >
                      🏛️ {memberDetail.history.tenureSummary}
                    </span>
                  )}
                  {memberProfileUrl && (
                    <a
                      className="link-pill"
                      href={memberProfileUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t("member_profile")} <ExternalIcon />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted">{t("member_missing")}</p>
          )}

          {/* High-Impact Adaptive Metric Ribbon */}
          <div className="metric-ribbon">
            <div className="metric-card">
              <div className="metric-card__value">
                {realContributions.length}
              </div>
              <div className="metric-card__label">
                {t("total_contributions")}
              </div>
              <div className="metric-card__sub">
                Verified plenary transcripts
              </div>
            </div>

            <div className="metric-card">
              <div
                className="metric-card__value"
                style={{ fontSize: topTopicName ? "1.25rem" : "1.5rem" }}
              >
                {topTopicName ||
                  (realContributions.length ? "General Plenary" : "—")}
              </div>
              <div className="metric-card__label">{t("top_topics")}</div>
              <div className="metric-card__sub">Primary policy focus</div>
            </div>

            <div className="metric-card">
              <div
                className="metric-card__value"
                style={{ fontSize: "1.25rem" }}
              >
                {latestContributionDate || "—"}
              </div>
              <div className="metric-card__label">
                {t("latest_contributions")}
              </div>
              <div className="metric-card__sub">
                Most recent indexed session
              </div>
            </div>

            <div className="metric-card">
              <div
                className="metric-card__value"
                style={{ fontSize: "1.25rem", color: "var(--ok)" }}
              >
                {participation?.summary?.activityLevel ??
                  (realContributions.length > 0 ? "Active" : "Indexed")}
              </div>
              <div className="metric-card__label">{t("activity_level")}</div>
              <div className="metric-card__sub">Official Senedd Record XML</div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="container" style={{ paddingTop: 24, paddingBottom: 48 }}>
        {loadingData ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 320,
              gap: 16,
            }}
          >
            <LoadingSpinner size={48} label={t("loading")} />
            <span className="text-muted text-sm">{t("loading")}</span>
          </div>
        ) : (
          <>
            {/* Navigation Tabs */}
            <div
              className="member-tabs-bar"
              role="tablist"
              aria-label={t("member_tabs")}
            >
              <button
                className={`member-tab-btn ${tab === "overview" ? "member-tab-btn--active" : ""}`}
                onClick={() => setActiveTab("overview")}
                type="button"
              >
                {t("tab_overview")}
              </button>
              <button
                className={`member-tab-btn ${tab === "contributions" ? "member-tab-btn--active" : ""}`}
                onClick={() => setActiveTab("contributions")}
                type="button"
              >
                {t("tab_contributions")}
                <span className="member-tab-counter">
                  {realContributions.length}
                </span>
              </button>
              <button
                className={`member-tab-btn ${tab === "votes" ? "member-tab-btn--active" : ""}`}
                onClick={() => setActiveTab("votes")}
                type="button"
              >
                {t("tab_votes")}
                <span className="member-tab-counter">{realVotes.length}</span>
              </button>
              <button
                className={`member-tab-btn ${tab === "history" ? "member-tab-btn--active" : ""}`}
                onClick={() => setActiveTab("history")}
                type="button"
              >
                {t("tab_history")}
                {memberDetail?.history?.terms &&
                  memberDetail.history.terms.length > 0 && (
                    <span className="member-tab-counter">
                      {memberDetail.history.terms.length}
                    </span>
                  )}
              </button>
              <button
                className={`member-tab-btn ${tab === "sources" ? "member-tab-btn--active" : ""}`}
                onClick={() => setActiveTab("sources")}
                type="button"
              >
                {t("tab_sources")}
              </button>
            </div>

            {/* TAB 1: OVERVIEW */}
            {tab === "overview" && (
              <div className="stack stack--24">
                {/* Topic Filter Pills */}
                {topicsForUi.length > 0 && (
                  <section className="card" style={{ padding: "18px 20px" }}>
                    <div
                      className="row row--8"
                      style={{
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 12,
                      }}
                    >
                      <span className="text-sm font-bold">
                        {t("top_topics")}
                      </span>
                      <button
                        className="btn btn--ghost btn--sm"
                        type="button"
                        onClick={() => setActiveTab("contributions")}
                      >
                        {t("view_topics")} →
                      </button>
                    </div>
                    <div className="topic-pills-row">
                      {topicsForUi.map((top) => {
                        const label =
                          top.key === "__other__" ? t("topic_other") : top.key;
                        return (
                          <button
                            key={top.key}
                            type="button"
                            className="topic-pill-btn"
                            onClick={() => {
                              setSelectedTopicKey(top.key);
                              setActiveTab("contributions");
                            }}
                          >
                            <span>{label}</span>
                            <span className="topic-pill-count">
                              {top.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* Latest Speeches & Contributions */}
                <section className="stack stack--12">
                  <div
                    className="row row--8"
                    style={{
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <h2 style={{ fontSize: "1.15rem", fontWeight: 800 }}>
                      {t("latest_contributions")}
                    </h2>
                    {realContributions.length > 3 && (
                      <button
                        className="btn btn--ghost btn--sm"
                        type="button"
                        onClick={() => setActiveTab("contributions")}
                      >
                        {t("view_all_contributions")} (
                        {realContributions.length}) →
                      </button>
                    )}
                  </div>

                  {realContributions.length > 0 ? (
                    <div className="stack stack--12">
                      {realContributions
                        .slice()
                        .sort((a, b) =>
                          b.occurredAt.localeCompare(a.occurredAt)
                        )
                        .slice(0, 3)
                        .map((it) => {
                          const snippet =
                            (lang === "cy" ? it.snippetCy : it.snippetEn) ??
                            it.snippetEn;
                          const meetingId = tryGetMeetingIdFromUrl(
                            it.sourceUrl
                          );
                          const recordUrl = meetingId
                            ? recordPageUrl(meetingId)
                            : null;
                          return (
                            <article className="speech-card" key={it.id}>
                              <div className="speech-card__header">
                                <div
                                  className="row row--8"
                                  style={{
                                    flexWrap: "wrap",
                                    alignItems: "center",
                                  }}
                                >
                                  <span className="speech-card__date">
                                    {formatDate(it.occurredAt)}
                                  </span>
                                  {it.primaryTopic && (
                                    <span className="badge badge--neutral">
                                      {it.primaryTopic}
                                    </span>
                                  )}
                                  <span className="badge badge--ok">
                                    {t("confidence_high")}
                                  </span>
                                </div>
                              </div>
                              <h3 className="speech-card__title">{it.title}</h3>
                              {snippet && (
                                <blockquote className="speech-card__quote">
                                  “{snippet}”
                                </blockquote>
                              )}
                              <div className="speech-card__actions">
                                <button
                                  className="btn btn--ghost btn--sm"
                                  type="button"
                                  onClick={() => void openSpeechReader(it)}
                                >
                                  {t("read_full")}
                                </button>
                                {recordUrl && (
                                  <a
                                    className="btn btn--ghost btn--sm"
                                    href={recordUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {t("view_record_page")} <ExternalIcon />
                                  </a>
                                )}
                              </div>
                            </article>
                          );
                        })}
                    </div>
                  ) : (
                    <div className="adaptive-info-card">
                      <div className="adaptive-info-card__title">
                        {t("no_verified_participation")}
                      </div>
                      <div className="adaptive-info-card__desc">
                        No speeches have been indexed for this Member in the
                        recent plenary exports. New transcripts will
                        automatically appear here as plenary sessions are
                        published.
                      </div>
                    </div>
                  )}
                </section>

                {/* Secondary Parliamentary Activity (Votes & Committees) */}
                <section className="stack stack--12">
                  <h2 style={{ fontSize: "1.15rem", fontWeight: 800 }}>
                    Parliamentary Activity & Context
                  </h2>

                  {realVotes.length === 0 && committeeMeetings.length === 0 ? (
                    <div className="card" style={{ padding: "20px 24px" }}>
                      <div
                        className="row row--8"
                        style={{ alignItems: "flex-start", gap: 12 }}
                      >
                        <div>
                          <h3
                            style={{
                              fontSize: "14px",
                              fontWeight: 700,
                              marginBottom: 4,
                            }}
                          >
                            Plenary Divisions & Committee Logs
                          </h3>
                          <p
                            className="text-sm text-muted"
                            style={{ lineHeight: 1.5 }}
                          >
                            No roll-call divisions or committee attendances were
                            recorded for this Member in the currently indexed
                            plenary meetings. Full voting records across all
                            terms are available directly in the official Senedd
                            directory.
                          </p>
                          <div style={{ marginTop: 12 }}>
                            {memberProfileUrl && (
                              <a
                                className="btn btn--ghost btn--sm"
                                href={memberProfileUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {t("member_profile")} <ExternalIcon />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="overview-panels">
                      {realVotes.length > 0 && (
                        <div className="card" style={{ padding: "16px 20px" }}>
                          <div className="card__header">
                            <span className="card__title">
                              {t("latest_votes")}
                            </span>
                            <button
                              className="btn btn--ghost btn--sm"
                              type="button"
                              onClick={() => setActiveTab("votes")}
                            >
                              {t("view_all_votes")} →
                            </button>
                          </div>
                          <div className="mini-list">
                            {realVotes.slice(0, 3).map((it) => {
                              const parsedVote = parseVoteFromItem(it, lang);
                              const badgeClass =
                                parsedVote.memberResult === "for"
                                  ? "badge--ok"
                                  : parsedVote.memberResult === "against"
                                    ? "badge--danger"
                                    : parsedVote.memberResult === "abstain"
                                      ? "badge--warn"
                                      : "badge--neutral";
                              return (
                                <div className="mini-item" key={it.id}>
                                  <div className="mini-item__meta">
                                    <span className="mini-item__date">
                                      {formatDate(it.occurredAt)}
                                    </span>
                                    <span className={`badge ${badgeClass}`}>
                                      {parsedVote.memberResult ?? "Unknown"}
                                    </span>
                                  </div>
                                  <div className="mini-item__title">
                                    {it.title}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {committeeMeetings.length > 0 && (
                        <div className="card" style={{ padding: "16px 20px" }}>
                          <div className="card__header">
                            <span className="card__title">
                              {t("committee_meetings_title")}
                            </span>
                          </div>
                          <div className="mini-list">
                            {committeeMeetings.slice(0, 3).map((it) => (
                              <div className="mini-item" key={it.id}>
                                <div className="mini-item__meta">
                                  <span className="mini-item__date">
                                    {formatDate(it.occurredAt)}
                                  </span>
                                </div>
                                <div className="mini-item__title">
                                  {it.title}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </section>

                {/* Subtle Provenance Note */}
                <div
                  className="text-xs text-muted"
                  style={{ textAlign: "center", marginTop: 8 }}
                >
                  {t("activity_indexed_note")} · {t("last_updated")}:{" "}
                  {participation?.lastUpdatedAt
                    ? new Date(participation.lastUpdatedAt).toLocaleDateString()
                    : "Live"}
                </div>
              </div>
            )}

            {/* TAB 2: SPEECHES & CONTRIBUTIONS */}
            {tab === "contributions" && (
              <div className="stack stack--16">
                <section className="card" style={{ padding: "20px" }}>
                  <div className="card__header" style={{ marginBottom: 16 }}>
                    <div>
                      <h2 className="card__title">{t("real_spoken_title")}</h2>
                      <p className="text-sm text-muted">
                        {t("real_spoken_desc")}
                      </p>
                    </div>
                    <span className="badge badge--ok">
                      {realContributions.length} {t("tab_contributions")}
                    </span>
                  </div>

                  {realContributions.length === 0 ? (
                    <div className="adaptive-info-card">
                      <div className="adaptive-info-card__title">
                        {t("no_verified_participation")}
                      </div>
                      <div className="adaptive-info-card__desc">
                        No spoken contributions recorded in the indexed
                        meetings.
                      </div>
                    </div>
                  ) : (
                    <div className="stack stack--16">
                      {topicsForUi.length > 1 && (
                        <div
                          className="topic-pills-row"
                          style={{ marginBottom: 4 }}
                        >
                          <button
                            type="button"
                            className={`topic-pill-btn ${selectedTopicKey === null ? "topic-pill-btn--active" : ""}`}
                            onClick={() => setSelectedTopicKey(null)}
                          >
                            <span>{t("vote_filter_all")}</span>
                            <span className="topic-pill-count">
                              {realContributions.length}
                            </span>
                          </button>
                          {topicsForUi.map((x) => {
                            const label =
                              x.key === "__other__" ? t("topic_other") : x.key;
                            const active = x.key === selectedTopicKey;
                            return (
                              <button
                                type="button"
                                key={x.key}
                                className={`topic-pill-btn ${active ? "topic-pill-btn--active" : ""}`}
                                onClick={() => setSelectedTopicKey(x.key)}
                              >
                                <span>{label}</span>
                                <span className="topic-pill-count">
                                  {x.count}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <div className="stack stack--16">
                        {(selectedTopicKey === null
                          ? realContributions
                              .slice()
                              .sort((a, b) =>
                                b.occurredAt.localeCompare(a.occurredAt)
                              )
                          : (selectedTopic?.items ?? [])
                        ).map((s) => {
                          const meetingId = tryGetMeetingIdFromUrl(s.sourceUrl);
                          const recordUrl = meetingId
                            ? recordPageUrl(meetingId)
                            : null;
                          const snippet =
                            (lang === "cy" ? s.snippetCy : s.snippetEn) ??
                            s.snippetEn;
                          return (
                            <article className="speech-card" key={s.id}>
                              <div className="speech-card__header">
                                <div
                                  className="row row--8"
                                  style={{
                                    flexWrap: "wrap",
                                    alignItems: "center",
                                  }}
                                >
                                  <span className="speech-card__date">
                                    {formatDate(s.occurredAt)}
                                  </span>
                                  {s.primaryTopic && (
                                    <span className="badge badge--neutral">
                                      {s.primaryTopic}
                                    </span>
                                  )}
                                  <span className="badge badge--ok">
                                    {t("confidence_high")}
                                  </span>
                                </div>
                              </div>
                              <h3 className="speech-card__title">{s.title}</h3>
                              {snippet && (
                                <blockquote className="speech-card__quote">
                                  “{snippet}”
                                </blockquote>
                              )}
                              <div className="speech-card__actions">
                                <button
                                  className="btn btn--ghost btn--sm"
                                  type="button"
                                  onClick={() => void openSpeechReader(s)}
                                >
                                  {t("read_full")}
                                </button>
                                {recordUrl && (
                                  <a
                                    className="btn btn--ghost btn--sm"
                                    href={recordUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {t("view_record_page")} <ExternalIcon />
                                  </a>
                                )}
                                <a
                                  className="btn btn--ghost btn--sm"
                                  href={s.sourceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {isSeneddTvUrl(s.sourceUrl)
                                    ? t("watch_video")
                                    : t("source_label")}{" "}
                                  <ExternalIcon />
                                </a>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* TAB 3: VOTES & DECISIONS */}
            {tab === "votes" && (
              <div className="stack stack--16">
                <section className="card" style={{ padding: "20px" }}>
                  <div className="card__header" style={{ marginBottom: 16 }}>
                    <div>
                      <h2 className="card__title">{t("real_votes_title")}</h2>
                      <p className="text-sm text-muted">
                        {t("real_votes_desc")}
                      </p>
                    </div>
                    <span className="badge badge--neutral">
                      {realVotes.length} {t("tab_votes")}
                    </span>
                  </div>

                  {realVotes.length === 0 ? (
                    <div className="adaptive-info-card">
                      <div className="adaptive-info-card__title">
                        {t("no_verified_votes")}
                      </div>
                      <div className="adaptive-info-card__desc">
                        No roll-call divisions were recorded in the indexed
                        plenary sessions for this Member. Roll-call votes occur
                        only when formal divisions are called in Plenary.
                      </div>
                      {memberProfileUrl && (
                        <div style={{ marginTop: 12 }}>
                          <a
                            className="btn btn--ghost btn--sm"
                            href={memberProfileUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View Member Page on Senedd.wales <ExternalIcon />
                          </a>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div
                        className="vote-filter"
                        role="group"
                        aria-label={t("vote_filter_label")}
                      >
                        {(
                          [
                            "cast",
                            "all",
                            "for",
                            "against",
                            "abstain",
                            "did_not_vote",
                          ] as VoteFilter[]
                        ).map((f) => (
                          <button
                            key={f}
                            type="button"
                            className={`vote-filter__btn ${voteFilter === f ? "vote-filter__btn--active" : ""}`}
                            onClick={() => setVoteFilter(f)}
                          >
                            {f === "cast"
                              ? t("vote_filter_cast")
                              : f === "all"
                                ? t("vote_filter_all")
                                : f === "for"
                                  ? t("vote_for")
                                  : f === "against"
                                    ? t("vote_against")
                                    : f === "abstain"
                                      ? t("vote_abstain")
                                      : t("vote_did_not_vote")}
                            <span className="vote-filter__count">
                              {voteCounts[f]}
                            </span>
                          </button>
                        ))}
                      </div>

                      <div className="stack stack--8" style={{ marginTop: 14 }}>
                        {filteredVotes.map((it) => {
                          const parsedVote = parseVoteFromItem(it, lang);
                          return (
                            <div
                              className="card"
                              key={it.id}
                              style={{ padding: "16px" }}
                            >
                              <div
                                className="row row--8"
                                style={{
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                }}
                              >
                                <div>
                                  <span className="text-xs text-muted">
                                    {formatDate(it.occurredAt)}
                                  </span>
                                  <div
                                    className="font-bold text-sm"
                                    style={{ marginTop: 2 }}
                                  >
                                    {it.title}
                                  </div>
                                </div>
                                <span
                                  className={`badge ${
                                    parsedVote.memberResult === "for"
                                      ? "badge--ok"
                                      : parsedVote.memberResult === "against"
                                        ? "badge--danger"
                                        : parsedVote.memberResult === "abstain"
                                          ? "badge--warn"
                                          : "badge--neutral"
                                  }`}
                                >
                                  {parsedVote.memberResult ?? "Unknown"}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </section>
              </div>
            )}

            {/* TAB 4: CAREER & HISTORICAL TERMS */}
            {tab === "history" && (
              <div className="stack stack--16">
                <section className="card" style={{ padding: "24px" }}>
                  <div className="card__header" style={{ marginBottom: 20 }}>
                    <div>
                      <h2 className="card__title">{t("history_title")}</h2>
                      <p className="text-sm text-muted">{t("history_desc")}</p>
                    </div>
                    {memberDetail?.history?.firstElectedYear && (
                      <span className="badge badge--ok">
                        {t("history_first_elected")}:{" "}
                        {memberDetail.history.firstElectedYear}
                      </span>
                    )}
                  </div>

                  {!memberDetail?.history?.terms ||
                  memberDetail.history.terms.length === 0 ? (
                    <div className="adaptive-info-card">
                      <div className="adaptive-info-card__title">
                        {t("history_no_terms")}
                      </div>
                      <div className="adaptive-info-card__desc">
                        No prior parliamentary terms or historic offices were
                        found for this Member in the electoral register. As
                        plenary sessions occur, their ongoing record will be
                        logged automatically.
                      </div>
                    </div>
                  ) : (
                    <div className="stack stack--16">
                      <div
                        style={{ position: "relative", paddingLeft: "28px" }}
                      >
                        {/* Timeline vertical spine */}
                        <div
                          style={{
                            position: "absolute",
                            left: "11px",
                            top: "8px",
                            bottom: "8px",
                            width: "2px",
                            background: "var(--border)",
                          }}
                        />

                        <div className="stack stack--16">
                          {memberDetail.history.terms.map((term, idx) => (
                            <div
                              key={`${term.house}-${term.startYear}-${idx}`}
                              style={{
                                position: "relative",
                              }}
                            >
                              {/* Timeline dot */}
                              <div
                                style={{
                                  position: "absolute",
                                  left: "-28px",
                                  top: "4px",
                                  width: "12px",
                                  height: "12px",
                                  borderRadius: "50%",
                                  background: term.isCurrent
                                    ? "var(--accent)"
                                    : "var(--surface3)",
                                  border: `2px solid ${term.isCurrent ? "var(--accent)" : "var(--border)"}`,
                                }}
                              />

                              <div
                                className="card"
                                style={{
                                  padding: "16px 20px",
                                  borderColor: term.isCurrent
                                    ? "var(--border-hover)"
                                    : "var(--border)",
                                }}
                              >
                                <div
                                  className="row row--8"
                                  style={{
                                    justifyContent: "space-between",
                                    alignItems: "flex-start",
                                    flexWrap: "wrap",
                                    gap: 8,
                                    marginBottom: 6,
                                  }}
                                >
                                  <div>
                                    <div
                                      className="font-bold"
                                      style={{ fontSize: "15px" }}
                                    >
                                      {term.house}
                                    </div>
                                    <div
                                      className="text-sm text-muted"
                                      style={{ marginTop: 2 }}
                                    >
                                      {term.constituency
                                        ? `Constituency / Region: ${term.constituency}`
                                        : "Member"}
                                      {term.party ? ` · ${term.party}` : ""}
                                    </div>
                                  </div>

                                  <div
                                    className="row row--8"
                                    style={{ alignItems: "center" }}
                                  >
                                    <span
                                      className={`badge ${term.isCurrent ? "badge--ok" : "badge--neutral"}`}
                                    >
                                      {term.isCurrent
                                        ? t("history_current_term")
                                        : t("history_past_term")}
                                    </span>
                                    <span
                                      className="font-bold text-xs"
                                      style={{
                                        color: "var(--text2)",
                                        background: "var(--surface2)",
                                        padding: "4px 8px",
                                        borderRadius: "var(--radius-sm)",
                                      }}
                                    >
                                      {term.startYear || "—"} –{" "}
                                      {term.endYear || "Present"}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* TAB 5: SOURCES & METHODOLOGY */}
            {tab === "sources" && (
              <div className="stack stack--16">
                <section className="card" style={{ padding: "20px" }}>
                  <div className="card__header" style={{ marginBottom: 12 }}>
                    <div>
                      <h2 className="card__title">
                        {t("record_exports_title")}
                      </h2>
                      <p className="text-sm text-muted">{t("exports_desc")}</p>
                    </div>
                  </div>

                  <div className="stack stack--8">
                    {exports?.items?.map((it, idx) => {
                      const anyUrl =
                        it.transcriptBilingualUrl ??
                        it.transcriptEnglishUrl ??
                        it.transcriptWelshUrl;
                      const meetingId = anyUrl
                        ? tryGetMeetingIdFromUrl(anyUrl)
                        : null;
                      return (
                        <div
                          className="card"
                          key={`${it.title}-${idx}`}
                          style={{ padding: "14px 18px" }}
                        >
                          <div
                            className="row row--8"
                            style={{
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <div>
                              <div className="font-bold text-sm">
                                {it.title}
                              </div>
                              {it.dateText && (
                                <div className="text-xs text-muted">
                                  {it.dateText}
                                </div>
                              )}
                            </div>
                            {meetingId && (
                              <a
                                className="btn btn--ghost btn--sm"
                                href={recordPageUrl(meetingId)}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {t("view_record_page")} <ExternalIcon />
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="text-xs text-muted" style={{ marginTop: 14 }}>
                    {t("source_label")}: Official Senedd Record of Proceedings
                    XML API (record.senedd.wales)
                  </div>
                </section>
              </div>
            )}
          </>
        )}
      </main>

      {/* In-App Verbatim Speech Reader Modal */}
      {readerOpen && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setReaderOpen(false);
          }}
        >
          <div className="modal">
            <div className="modal__header">
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div className="modal__title">{t("read_full")}</div>
                {readerDetail ? (
                  <div className="text-xs text-muted">
                    {readerDetail.speakerName} ·{" "}
                    {formatDate(readerDetail.occurredAt)}
                  </div>
                ) : null}
              </div>
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => setReaderOpen(false)}
                type="button"
              >
                {t("close")}
              </button>
            </div>
            <div className="modal__body">
              <div
                className="row row--8"
                style={{ justifyContent: "space-between", marginBottom: 14 }}
              >
                <div className="row row--8" style={{ alignItems: "center" }}>
                  <span className="text-xs text-muted">
                    {t("language_label")}:
                  </span>
                  <select
                    className="nav__lang-select"
                    value={readerLang}
                    onChange={(e) =>
                      setReaderLang(e.target.value === "cy" ? "cy" : "en")
                    }
                    aria-label={t("language_label")}
                  >
                    <option value="en">{t("lang_en")}</option>
                    <option value="cy">{t("lang_cy")}</option>
                  </select>
                </div>
                {readerDetail && (
                  <div className="row row--8">
                    {readerDetail.recordPageUrl && (
                      <a
                        className="link-pill"
                        href={readerDetail.recordPageUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t("view_record_page")} <ExternalIcon />
                      </a>
                    )}
                    {readerDetail.sourceUrl && (
                      <a
                        className="link-pill"
                        href={readerDetail.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {isSeneddTvUrl(readerDetail.sourceUrl)
                          ? t("watch_video")
                          : t("official_source")}{" "}
                        <ExternalIcon />
                      </a>
                    )}
                  </div>
                )}
              </div>

              {readerLoading ? (
                <div style={{ padding: "24px 0", textAlign: "center" }}>
                  <LoadingSpinner size={32} label={t("loading")} />
                </div>
              ) : readerError ? (
                <div className="alert alert--danger text-sm">{readerError}</div>
              ) : readerDetail ? (
                <div className="reader-text">
                  {(readerLang === "cy"
                    ? readerDetail.fullTextCy
                    : readerDetail.fullTextEn) ||
                    (readerLang === "cy"
                      ? readerDetail.fullTextEn
                      : readerDetail.fullTextCy) ||
                    t("full_text_unavailable")}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
