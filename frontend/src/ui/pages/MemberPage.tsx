import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useI18n } from "../../i18n/I18nContext";
import { LoadingSpinner } from "../Logo";
import { useToast } from "../Toast";
import { MemberAvatar } from "../MemberAvatar";
import * as api from "../../lib/api";

type MsLite = api.SearchResponse["members"][number];
type MemberTab = "overview" | "contributions" | "votes" | "sources";
type VoteFilter = "all" | "for" | "against" | "abstain" | "did_not_vote";

function tabFromHash(hash: string): MemberTab {
  const h = (hash || "").replace(/^#/, "").trim().toLowerCase();
  if (h === "contributions") return "contributions";
  if (h === "votes") return "votes";
  if (h === "sources") return "sources";
  return "overview";
}

function BackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function confidenceBadge(confidence: "high" | "medium" | "low", label: string) {
  const variant = confidence === "high" ? "ok" : confidence === "medium" ? "warn" : "danger";
  return <span className={`badge badge--${variant}`}>{label}</span>;
}

function noteKeyToTranslationKey(noteKey: string) {
  switch (noteKey) {
    case "limited_to_recent_plenary_exports": return "data_note_limited_recent_plenary_exports";
    case "name_matching_uncertain": return "data_note_name_matching_uncertain";
    case "no_recent_contributions_found": return "data_note_no_recent_contributions_found";
    case "upstream_or_parse_issue": return "data_note_upstream_or_parse_issue";
    default: return null;
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function tryGetMeetingIdFromUrl(url: string): number | null {
  try {
    const u = new URL(url);
    const id = u.searchParams.get("meetingID") ?? u.searchParams.get("meetingId");
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
    const u = new URL(url);
    return u.hostname.toLowerCase().includes("senedd.tv");
  } catch {
    return false;
  }
}

interface VoteParsed {
  memberResult: "for" | "against" | "abstain" | "did_not_vote" | null;
  overall: string | null;
  totals: { for: number; against: number; abstain: number } | null;
}

function parseVoteSnippet(snippet: string | null | undefined): VoteParsed {
  if (!snippet) return { memberResult: null, overall: null, totals: null };
  const memberMatch = /member result:\s*(for|against|abstain)/i.exec(snippet);
  const overallMatch = /overall:\s*([^.]+)/i.exec(snippet);
  const totalsMatch = /totals:\s*for\s+(\d+)[,\s]+against\s+(\d+)[,\s]+abstain\s+(\d+)/i.exec(snippet);
  return {
    memberResult: memberMatch ? (memberMatch[1].toLowerCase() as VoteParsed["memberResult"]) : null,
    overall: overallMatch ? overallMatch[1].trim() : null,
    totals: totalsMatch
      ? { for: parseInt(totalsMatch[1], 10), against: parseInt(totalsMatch[2], 10), abstain: parseInt(totalsMatch[3], 10) }
      : null,
  };
}

function parseVoteFromItem(it: api.ParticipationItem, lang: "en" | "cy"): VoteParsed {
  if (it.vote) {
    const overall =
      (lang === "cy" ? it.vote.overallCy : it.vote.overallEn) ??
      it.vote.overallEn ??
      it.vote.overallCy ??
      null;
    return { memberResult: it.vote.memberResult, overall, totals: it.vote.totals };
  }
  const snippet = (lang === "cy" ? it.snippetCy : it.snippetEn) ?? it.snippetEn;
  return parseVoteSnippet(snippet);
}

function VoteResultCard({ parsed, t }: { parsed: VoteParsed; t: (k: string) => string }) {
  const total = parsed.totals ? parsed.totals.for + parsed.totals.against + parsed.totals.abstain : 0;
  const forPct = total > 0 ? (parsed.totals!.for / total) * 100 : 0;
  const againstPct = total > 0 ? (parsed.totals!.against / total) * 100 : 0;
  const abstainPct = total > 0 ? (parsed.totals!.abstain / total) * 100 : 0;

  const memberClass =
    parsed.memberResult === "for" ? "vote-verdict--for"
      : parsed.memberResult === "against" ? "vote-verdict--against"
        : parsed.memberResult === "abstain" ? "vote-verdict--abstain"
          : parsed.memberResult === "did_not_vote" ? "vote-verdict--neutral"
          : "vote-verdict--neutral";

  const memberLabel =
    parsed.memberResult === "for" ? t("vote_for")
      : parsed.memberResult === "against" ? t("vote_against")
        : parsed.memberResult === "abstain" ? t("vote_abstain")
          : parsed.memberResult === "did_not_vote" ? t("vote_did_not_vote")
          : t("vote_unknown");

  return (
    <div className="vote-result-card">
      <div className="vote-result-card__top">
        <div className={`vote-verdict ${memberClass}`}>{memberLabel}</div>
        {parsed.overall ? <div className="vote-result-card__overall">{parsed.overall}</div> : null}
      </div>

      {parsed.memberResult === "did_not_vote" ? (
        <div className="vote-result-card__note">{t("vote_member_note_did_not_vote")}</div>
      ) : parsed.memberResult == null ? (
        <div className="vote-result-card__note">{t("vote_member_note_unknown")}</div>
      ) : null}

      {parsed.totals && (
        <div className="vote-result-card__tally">
          <div className="vote-tally-bar" aria-label={t("vote_totals")}>
            {forPct > 0 && <div className="vote-tally-bar__seg vote-tally-bar__seg--for" style={{ width: `${forPct}%` }} />}
            {abstainPct > 0 && <div className="vote-tally-bar__seg vote-tally-bar__seg--abstain" style={{ width: `${abstainPct}%` }} />}
            {againstPct > 0 && <div className="vote-tally-bar__seg vote-tally-bar__seg--against" style={{ width: `${againstPct}%` }} />}
          </div>
          <div className="vote-tally-labels">
            <span className="vote-tally-labels__for">
              <span className="vote-tally-dot vote-tally-dot--for" />
              {t("vote_for")} <strong>{parsed.totals.for}</strong>
            </span>
            {parsed.totals.abstain > 0 && (
              <span className="vote-tally-labels__abstain">
                <span className="vote-tally-dot vote-tally-dot--abstain" />
                {t("vote_abstain")} <strong>{parsed.totals.abstain}</strong>
              </span>
            )}
            <span className="vote-tally-labels__against">
              <span className="vote-tally-dot vote-tally-dot--against" />
              {t("vote_against")} <strong>{parsed.totals.against}</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className={`member-tab ${active ? "member-tab--active" : ""}`} onClick={onClick} type="button">
      {children}
    </button>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="empty-state" style={{ marginTop: 10 }}>{children}</div>;
}

export default function MemberPage() {
  const { id } = useParams();
  const { lang, t } = useI18n();
  const toast = useToast();

  const [tab, setTab] = useState<MemberTab>(() => tabFromHash(typeof window === "undefined" ? "" : window.location.hash));
  const [voteFilter, setVoteFilter] = useState<VoteFilter>("all");
  const [topicQuery, setTopicQuery] = useState("");
  const [selectedTopicKey, setSelectedTopicKey] = useState<string | null>(null);

  const [memberDetail, setMemberDetail] = useState<api.MemberResponse | null>(null);
  const [exports, setExports] = useState<api.PlenaryExportsResponse | null>(null);
  const [availability, setAvailability] = useState<api.DataAvailabilityResponse | null>(null);
  const [participation, setParticipation] = useState<api.ParticipationResponse | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const [readerOpen, setReaderOpen] = useState(false);
  const [readerLoading, setReaderLoading] = useState(false);
  const [readerError, setReaderError] = useState<string | null>(null);
  const [readerDetail, setReaderDetail] = useState<api.SpokenContributionDetail | null>(null);
  const [readerLang, setReaderLang] = useState<"en" | "cy">("en");

  const member: MsLite | null = useMemo(() => {
    if (!id) return null;
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
    api.getMember(id).then(setMemberDetail).catch(() => setMemberDetail(null));
    setLoadingData(true);
    Promise.all([
      api.getRecentPlenaryExports(8).then(setExports).catch(() => setExports(null)),
      api.getDataAvailability().then(setAvailability).catch(() => setAvailability(null)),
      api.getMemberParticipation(id).then(setParticipation).catch(() => setParticipation(null)),
    ]).finally(() => setLoadingData(false));
  }, [id]);

  const setActiveTab = (next: MemberTab) => {
    setTab(next);
    if (typeof window !== "undefined") window.location.hash = next === "overview" ? "overview" : next;
  };

  const realContributions = participation?.real?.items?.filter((i) => i.kind === "speech" || i.kind === "question" || i.kind === "motion") ?? [];
  const realVotes = participation?.real?.items?.filter((i) => i.kind === "vote") ?? [];
  const committeeMeetings = participation?.real?.items?.filter((i) => i.kind === "committee") ?? [];

  const uniqueTimestamps = new Set(realContributions.map((i) => i.occurredAt)).size;
  const showTimestampNote = realContributions.length >= 2 && uniqueTimestamps === 1;

  const memberName = memberDetail?.name ?? member?.name ?? null;
  const memberParty = memberDetail?.party ?? member?.party ?? null;
  const memberAreaName = memberDetail?.areaName ?? member?.areaName ?? null;
  const memberProfileUrl = memberDetail?.profileUrl ?? member?.profileUrl ?? null;
  const memberImageUrl = memberDetail?.imageUrl ?? member?.imageUrl ?? null;

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
    } catch (e: any) {
      setReaderError(String(e?.message ?? e));
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

    const out: Array<{ key: string; count: number; items: api.ParticipationItem[] }> = [];

    for (const key of orderedKeys) {
      const items = (byTopic.get(key) ?? []).slice().sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
      if (items.length === 0) continue;
      out.push({ key, count: counts.get(key) ?? items.length, items });
      seen.add(key);
    }

    for (const [key, itemsRaw] of byTopic.entries()) {
      if (seen.has(key)) continue;
      const items = itemsRaw.slice().sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
      out.push({ key, count: items.length, items });
    }

    if (other.length) {
      const items = other.slice().sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
      out.push({ key: "__other__", count: items.length, items });
    }

    return out;
  }, [participation?.summary?.topicBreakdown, realContributions]);

  const filteredTopics = useMemo(() => {
    const q = topicQuery.trim().toLowerCase();
    if (!q) return topicsForUi;
    return topicsForUi.filter((x) => (x.key === "__other__" ? t("topic_other") : x.key).toLowerCase().includes(q));
  }, [topicQuery, topicsForUi, t]);

  useEffect(() => {
    if (!filteredTopics.length) {
      setSelectedTopicKey(null);
      return;
    }
    if (selectedTopicKey && filteredTopics.some((x) => x.key === selectedTopicKey)) return;
    setSelectedTopicKey(filteredTopics[0].key);
  }, [filteredTopics, selectedTopicKey]);

  const selectedTopic = selectedTopicKey ? filteredTopics.find((x) => x.key === selectedTopicKey) ?? null : null;
  const selectedTopicLabel = selectedTopic?.key === "__other__" ? t("topic_other") : selectedTopic?.key ?? "";

  const filteredVotes = useMemo(() => {
    const items = realVotes.slice().sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    if (voteFilter === "all") return items;
    return items.filter((v) => parseVoteFromItem(v, lang).memberResult === voteFilter);
  }, [lang, realVotes, voteFilter]);

  const voteCounts = useMemo(() => {
    const c = { all: realVotes.length, for: 0, against: 0, abstain: 0, did_not_vote: 0 };
    for (const v of realVotes) {
      const r = parseVoteFromItem(v, lang).memberResult;
      if (r === "for") c.for++;
      if (r === "against") c.against++;
      if (r === "abstain") c.abstain++;
      if (r === "did_not_vote") c.did_not_vote++;
    }
    return c;
  }, [lang, realVotes]);

  if (!id) return null;

  return (
    <>
      {loadingData ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 320, gap: 16 }}>
          <LoadingSpinner size={56} label={t("loading")} />
          <span className="text-muted text-sm">{t("loading")}</span>
        </div>
      ) : null}

      <div className="member-hero">
        <div className="container">
          <div className="member-hero__back" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Link to="/" className="btn btn--ghost btn--sm">
              <BackIcon /> {t("nav_home")}
            </Link>
            <button
              className="btn btn--ghost btn--sm share-btn"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href).then(() => {
                  toast.show(t("copied"), "ok");
                });
              }}
              title={t("copy_link")}
              type="button"
            >
              <ShareIcon /> {t("copy_link")}
            </button>
          </div>

          {memberName ? (
            <div className="member-hero__header">
              <MemberAvatar name={memberName} imageUrl={memberImageUrl} size={72} />
              <div>
                <h1 className="member-hero__name">{memberName}</h1>
                <div className="member-hero__meta">
                  {memberParty && <span className="badge badge--neutral">{memberParty}</span>}
                  {memberAreaName && <span className="badge badge--neutral">{memberAreaName}</span>}
                  {memberProfileUrl && (
                    <a className="link-pill" href={memberProfileUrl} target="_blank" rel="noreferrer">
                      {t("member_profile")} <ExternalIcon />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted">{t("member_missing")}</p>
          )}
        </div>
      </div>

      <div className="container" style={{ paddingTop: 18, paddingBottom: 44 }}>
        {loadingData ? null : (
        <div className="member-tabs" role="tablist" aria-label={t("member_tabs")}>
          <TabButton active={tab === "overview"} onClick={() => setActiveTab("overview")}>
            {t("tab_overview")}
          </TabButton>
          <TabButton active={tab === "contributions"} onClick={() => setActiveTab("contributions")}>
            {t("tab_contributions")}{" "}
            {realContributions.length ? <span className="member-tab__count">{realContributions.length}</span> : null}
          </TabButton>
          <TabButton active={tab === "votes"} onClick={() => setActiveTab("votes")}>
            {t("tab_votes")}{" "}
            {realVotes.length ? <span className="member-tab__count">{realVotes.length}</span> : null}
          </TabButton>
          <TabButton active={tab === "sources"} onClick={() => setActiveTab("sources")}>
            {t("tab_sources")}
          </TabButton>
        </div>
        )}

        {!loadingData && tab === "overview" && (
          <div className="stack stack--16" style={{ marginTop: 18 }}>
            {participation?.summary ? (
              <section className="card">
                <div className="card__header">
                  <div className="card__title">{t("activity_summary")}</div>
                  <div className="row row--8">
                    <span className="text-sm text-muted">
                      {t("last_updated")}: {participation.lastUpdatedAt ? new Date(participation.lastUpdatedAt).toLocaleString() : "—"}
                    </span>
                    <button
                      className="btn btn--ghost btn--sm"
                      disabled={refreshing}
                      onClick={async () => {
                        setRefreshError(null);
                        setRefreshing(true);
                        try {
                          await api.refreshData({ maxMeetings: 20, force: false });
                          if (id) setParticipation(await api.getMemberParticipation(id));
                          setExports(await api.getRecentPlenaryExports(8));
                          toast.show(t("refresh_success"), "ok");
                        } catch (e: any) {
                          const msg = String(e?.message ?? e);
                          setRefreshError(msg);
                          toast.show(msg, "error");
                        } finally {
                          setRefreshing(false);
                        }
                      }}
                      type="button"
                    >
                      <RefreshIcon /> {refreshing ? t("refreshing") : t("refresh_data")}
                    </button>
                  </div>
                </div>

                {refreshError && <div className="alert alert--danger" style={{ marginBottom: 12 }}>{refreshError}</div>}

                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-card__value">{participation.summary.totalContributions}</div>
                    <div className="stat-card__label">{t("total_contributions")}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-card__value">{participation.summary.contributionsLast30Days}</div>
                    <div className="stat-card__label">{t("last_30_days")}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-card__value" style={{ fontSize: "1.4rem" }}>{participation.summary.activityLevel}</div>
                    <div className="stat-card__label">{t("activity_level")}</div>
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <div className="alert alert--info text-sm">
                    {t("member_overview_generated").replace("{count}", String(participation.summary.totalContributions))}
                  </div>
                </div>
              </section>
            ) : null}

            <section className="card">
              <div className="card__header">
                <div className="card__title">{t("participation_title")}</div>
                {participation?.real?.partial ? <span className="badge badge--warn">{t("status_partial")}</span> : <span className="badge badge--ok">{t("status_available")}</span>}
              </div>
              <div className="text-sm text-muted" style={{ marginBottom: 12 }}>{t("participation_help")}</div>

              {participation?.real?.partial && (
                <div className="alert alert--warn text-sm" style={{ marginBottom: 12 }}>{t("data_partial_warning")}</div>
              )}
              {showTimestampNote && (
                <div className="alert alert--info text-sm" style={{ marginBottom: 12 }}>{t("timestamp_note")}</div>
              )}
              {participation?.real?.dataNotes?.length ? (
                <div className="stack stack--4" style={{ marginBottom: 4 }}>
                  {participation.real.dataNotes
                    .map(noteKeyToTranslationKey)
                    .filter(Boolean)
                    .map((k) => (
                      <div className="text-sm text-muted" key={k as string}>{"\u2022"} {t(k as string)}</div>
                    ))}
                </div>
              ) : null}

              <div className="divider" />

              <div className="row row--8" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <div className="text-sm" style={{ fontWeight: 800 }}>{t("top_topics")}</div>
                <button className="btn btn--ghost btn--sm" type="button" onClick={() => setActiveTab("contributions")}>
                  {t("view_topics")}
                </button>
              </div>
              <div className="member-chips" style={{ marginTop: 10 }}>
                {(participation?.summary?.topTopics ?? []).slice(0, 10).map((x) => (
                  <span key={x} className="badge badge--neutral">{x}</span>
                ))}
                {!participation?.summary?.topTopics?.length ? <span className="text-sm text-muted">—</span> : null}
              </div>
              <div className="text-xs text-muted" style={{ marginTop: 10 }}>{t("activity_indexed_note")}</div>
            </section>
          </div>
        )}

        {!loadingData && tab === "contributions" && (
          <div className="stack stack--16" style={{ marginTop: 18 }}>
            <section className="card">
              <div className="card__header">
                <div className="card__title">{t("real_spoken_title")}</div>
                <span className="badge badge--warn">{t("status_partial")}</span>
              </div>
              <div className="text-sm text-muted" style={{ marginBottom: 12 }}>{t("real_spoken_desc")}</div>

              {participation?.real?.partial && (
                <div className="alert alert--warn text-sm" style={{ marginBottom: 12 }}>{t("data_partial_warning")}</div>
              )}
              {showTimestampNote && (
                <div className="alert alert--info text-sm" style={{ marginBottom: 12 }}>{t("timestamp_note")}</div>
              )}

              {realContributions.length === 0 ? (
                <EmptyState>{t("no_verified_participation")}</EmptyState>
              ) : (
                <div className="topic-layout">
                  <div className="topic-sidebar">
                    <input
                      className="input topic-search"
                      value={topicQuery}
                      onChange={(e) => setTopicQuery(e.target.value)}
                      placeholder={t("topic_search_placeholder")}
                      aria-label={t("topic_search_placeholder")}
                    />
                    <div className="topic-list" role="list">
                      {filteredTopics.map((x) => {
                        const label = x.key === "__other__" ? t("topic_other") : x.key;
                        const active = x.key === selectedTopicKey;
                        return (
                          <button
                            type="button"
                            key={x.key}
                            className={`topic-list__item ${active ? "topic-list__item--active" : ""}`}
                            onClick={() => setSelectedTopicKey(x.key)}
                          >
                            <span className="topic-list__name">{label}</span>
                            <span className="badge badge--neutral">{x.count}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="text-xs text-muted" style={{ marginTop: 10 }}>{t("topic_note")}</div>
                  </div>

                  <div className="topic-panel">
                    {selectedTopic ? (
                      <>
                        <div className="row row--8" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                          <h3 className="topic-panel__title">{selectedTopicLabel}</h3>
                          <span className="badge badge--neutral">{selectedTopic.count}</span>
                        </div>
                        <div className="topic-entry-list">
                          {selectedTopic.items.slice(0, 30).map((s) => {
                            const meetingId = tryGetMeetingIdFromUrl(s.sourceUrl);
                            const recordUrl = meetingId ? recordPageUrl(meetingId) : null;
                            const showRecordLink = !!recordUrl && recordUrl !== s.sourceUrl;
                            const showSourceLink = !recordUrl || recordUrl !== s.sourceUrl;
                            const snippet = (lang === "cy" ? s.snippetCy : s.snippetEn) ?? s.snippetEn;

                            return (
                              <div className="topic-entry" key={s.id}>
                                <div className="topic-entry__meta">
                                  <span className="text-xs text-muted">{formatDate(s.occurredAt)}</span>
                                  {confidenceBadge(
                                    s.confidence,
                                    s.confidence === "high" ? t("confidence_high")
                                      : s.confidence === "medium" ? t("confidence_medium")
                                        : t("confidence_low"),
                                  )}
                                </div>
                                <div className="topic-entry__title">{s.title}</div>
                                {snippet ? <div className="topic-entry__snippet">{snippet}</div> : null}
                                <div className="topic-entry__actions">
                                  <button className="btn btn--ghost btn--sm" type="button" onClick={() => void openSpeechReader(s)}>
                                    {t("read_full")}
                                  </button>
                                  {showRecordLink && recordUrl && (
                                    <a className="btn btn--ghost btn--sm" href={recordUrl} target="_blank" rel="noreferrer">
                                      {t("view_record_page")} <ExternalIcon />
                                    </a>
                                  )}
                                  {showSourceLink && (
                                    <a className="btn btn--ghost btn--sm" href={s.sourceUrl} target="_blank" rel="noreferrer">
                                      {isSeneddTvUrl(s.sourceUrl) ? t("watch_video") : t("source_label")} <ExternalIcon />
                                    </a>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {selectedTopic.items.length > 30 && (
                          <div className="text-xs text-muted" style={{ marginTop: 10 }}>
                            {t("showing_latest_n").replace("{n}", String(30))}
                          </div>
                        )}
                      </>
                    ) : (
                      <EmptyState>—</EmptyState>
                    )}
                  </div>
                </div>
              )}
            </section>

            <section className="card">
              <div className="card__header">
                <div className="card__title">{t("committee_meetings_title")}</div>
                <span className="badge badge--neutral">{committeeMeetings.length}</span>
              </div>
              <div className="text-sm text-muted" style={{ marginBottom: 12 }}>{t("committee_meetings_desc")}</div>

              {committeeMeetings.length === 0 ? (
                <EmptyState>{t("committee_none_found")}</EmptyState>
              ) : (
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{t("table_date")}</th>
                        <th>{t("table_item")}</th>
                        <th>{t("table_status")}</th>
                        <th className="data-table__actions">{t("table_actions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {committeeMeetings
                        .slice()
                        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
                        .slice(0, 14)
                        .map((it) => {
                          const snippet = (lang === "cy" ? it.snippetCy : it.snippetEn) ?? it.snippetEn;
                          return (
                            <tr key={it.id}>
                              <td className="data-table__muted">{formatDate(it.occurredAt)}</td>
                              <td>
                                <div className="data-table__title">{it.title}</div>
                                {snippet ? <div className="data-table__sub">{snippet}</div> : null}
                              </td>
                              <td>{confidenceBadge(it.confidence, t("confidence_high"))}</td>
                              <td className="data-table__actions">
                                <a className="btn btn--ghost btn--sm" href={it.sourceUrl} target="_blank" rel="noreferrer">
                                  {t("source_label")} <ExternalIcon />
                                </a>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {!loadingData && tab === "votes" && (
          <div className="stack stack--16" style={{ marginTop: 18 }}>
            <section className="card">
              <div className="card__header">
                <div className="card__title">{t("real_votes_title")}</div>
                <span className="badge badge--warn">{t("status_partial")}</span>
              </div>
              <div className="text-sm text-muted" style={{ marginBottom: 12 }}>{t("real_votes_desc")}</div>

              {realVotes.length === 0 ? (
                <EmptyState>{t("no_verified_votes")}</EmptyState>
              ) : (
                <>
                  <div className="vote-filter" role="group" aria-label={t("vote_filter_label")}>
                    <button type="button" className={`vote-filter__btn ${voteFilter === "all" ? "vote-filter__btn--active" : ""}`} onClick={() => setVoteFilter("all")}>
                      {t("vote_filter_all")} <span className="vote-filter__count">{voteCounts.all}</span>
                    </button>
                    <button type="button" className={`vote-filter__btn ${voteFilter === "for" ? "vote-filter__btn--active" : ""}`} onClick={() => setVoteFilter("for")}>
                      {t("vote_for")} <span className="vote-filter__count">{voteCounts.for}</span>
                    </button>
                    <button type="button" className={`vote-filter__btn ${voteFilter === "against" ? "vote-filter__btn--active" : ""}`} onClick={() => setVoteFilter("against")}>
                      {t("vote_against")} <span className="vote-filter__count">{voteCounts.against}</span>
                    </button>
                    <button type="button" className={`vote-filter__btn ${voteFilter === "abstain" ? "vote-filter__btn--active" : ""}`} onClick={() => setVoteFilter("abstain")}>
                      {t("vote_abstain")} <span className="vote-filter__count">{voteCounts.abstain}</span>
                    </button>
                    <button type="button" className={`vote-filter__btn ${voteFilter === "did_not_vote" ? "vote-filter__btn--active" : ""}`} onClick={() => setVoteFilter("did_not_vote")}>
                      {t("vote_did_not_vote")} <span className="vote-filter__count">{voteCounts.did_not_vote}</span>
                    </button>
                  </div>

                  <div className="stack stack--8" style={{ marginTop: 12 }}>
                    {filteredVotes.slice(0, 40).map((it) => {
                      const meetingId = tryGetMeetingIdFromUrl(it.sourceUrl);
                      const recordUrl = meetingId ? recordPageUrl(meetingId) : null;
                      const showRecordLink = !!recordUrl && recordUrl !== it.sourceUrl;
                      const showSourceLink = !recordUrl || recordUrl !== it.sourceUrl;
                      const parsedVote = parseVoteFromItem(it, lang);

                      return (
                        <details className="vote-item" key={it.id}>
                          <summary className="vote-item__summary">
                            <div className="vote-item__left">
                              <div className="vote-item__date">{formatDate(it.occurredAt)}</div>
                              <div className="vote-item__title">{it.title}</div>
                            </div>
                            <div className="vote-item__right">
                              <span
                                className={`badge ${
                                  parsedVote.memberResult === "for"
                                    ? "badge--ok"
                                    : parsedVote.memberResult === "against"
                                      ? "badge--danger"
                                      : parsedVote.memberResult === "abstain"
                                        ? "badge--warn"
                                        : parsedVote.memberResult === "did_not_vote"
                                          ? "badge--neutral"
                                        : "badge--neutral"
                                }`}
                              >
                                {parsedVote.memberResult === "for"
                                  ? t("vote_for")
                                  : parsedVote.memberResult === "against"
                                    ? t("vote_against")
                                    : parsedVote.memberResult === "abstain"
                                      ? t("vote_abstain")
                                      : parsedVote.memberResult === "did_not_vote"
                                        ? t("vote_did_not_vote")
                                      : t("vote_unknown")}
                              </span>
                            </div>
                          </summary>
                          <div className="vote-item__body">
                            <VoteResultCard parsed={parsedVote} t={t} />
                            <div className="row row--8" style={{ marginTop: 10, flexWrap: "wrap" }}>
                              {showRecordLink && recordUrl && (
                                <a className="btn btn--ghost btn--sm" href={recordUrl} target="_blank" rel="noreferrer">
                                  {t("view_record_page")} <ExternalIcon />
                                </a>
                              )}
                              {showSourceLink && (
                                <a className="btn btn--ghost btn--sm" href={it.sourceUrl} target="_blank" rel="noreferrer">
                                  {t("source_label")} <ExternalIcon />
                                </a>
                              )}
                              {confidenceBadge(
                                it.confidence,
                                it.confidence === "high" ? t("confidence_high")
                                  : it.confidence === "medium" ? t("confidence_medium")
                                    : t("confidence_low"),
                              )}
                            </div>
                          </div>
                        </details>
                      );
                    })}
                    {filteredVotes.length > 40 && (
                      <div className="text-xs text-muted">{t("showing_latest_n").replace("{n}", String(40))}</div>
                    )}
                  </div>
                </>
              )}
            </section>
          </div>
        )}

        {!loadingData && tab === "sources" && (
          <div className="stack stack--16" style={{ marginTop: 18 }}>
            <section className="card">
              <div className="card__header">
                <div className="card__title">{t("record_exports_title")}</div>
                {availability && (() => {
                  const s = availability.metrics.find((m) => m.id === "spoken_contributions")?.status ?? "partial";
                  const variant = s === "available" ? "ok" : s === "partial" ? "warn" : "danger";
                  const label = s === "available" ? t("status_available") : s === "partial" ? t("status_partial") : t("status_not_available");
                  return <span className={`badge badge--${variant}`}>{label}</span>;
                })()}
              </div>
              <p className="section-sub text-muted text-sm">{t("exports_desc")}</p>

              <div className="alert alert--info text-sm" style={{ marginBottom: 12 }}>{t("exports_tip")}</div>

              {exports?.items?.length ? (
                <div className="stack stack--8">
                  {exports.items.map((it, idx) => {
                    const anyUrl =
                      it.transcriptBilingualUrl ??
                      it.transcriptEnglishUrl ??
                      it.transcriptWelshUrl ??
                      it.votesBilingualUrl;
                    const meetingId = anyUrl ? tryGetMeetingIdFromUrl(anyUrl) : null;
                    return (
                      <div className="card source-card" key={`${it.title}-${idx}`} style={{ padding: "16px" }}>
                        <span className="font-bold text-sm" style={{ marginBottom: 4, display: "block" }}>{it.title}</span>
                        {it.dateText && (
                          <span className="text-xs text-muted" style={{ marginBottom: 10, display: "block" }}>{it.dateText}</span>
                        )}
                        {meetingId ? (
                          <a
                            className="btn btn--ghost btn--sm"
                            href={recordPageUrl(meetingId)}
                            target="_blank"
                            rel="noreferrer"
                            style={{ display: "inline-flex" }}
                          >
                            {t("view_record_page")} <ExternalIcon />
                          </a>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState>{t("record_exports_empty")}</EmptyState>
              )}

              {exports && (
                <div className="text-sm text-muted" style={{ marginTop: 10 }}>
                  {t("source_label")}:{" "}
                  <a href={exports.sourceUrl} target="_blank" rel="noreferrer">
                    {new URL(exports.sourceUrl).host}
                  </a>{" "}
                  · {exports.fromCache ? t("cache_cached") : t("cache_live")}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

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
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div className="modal__title">{t("read_full")}</div>
                {readerDetail ? (
                  <div className="text-xs text-muted">
                    {readerDetail.speakerName} · {new Date(readerDetail.occurredAt).toLocaleString()}
                  </div>
                ) : null}
              </div>
              <button className="btn btn--ghost btn--sm" onClick={() => setReaderOpen(false)} type="button">
                {t("close")}
              </button>
            </div>

            <div className="modal__body">
              <div className="row row--8" style={{ justifyContent: "space-between", marginBottom: 12 }}>
                <div className="row row--8">
                  <span className="text-xs text-muted">{t("language_label")}:</span>
                  <select
                    className="nav__lang-select"
                    value={readerLang}
                    onChange={(e) => setReaderLang(e.target.value === "cy" ? "cy" : "en")}
                    aria-label={t("language_label")}
                  >
                    <option value="en">{t("lang_en")}</option>
                    <option value="cy">{t("lang_cy")}</option>
                  </select>
                </div>
                {readerDetail ? (
                  <div className="row row--8">
                    <a className="link-pill" href={readerDetail.recordPageUrl} target="_blank" rel="noreferrer">
                      {t("view_record_page")} <ExternalIcon />
                    </a>
                    <a className="link-pill" href={readerDetail.sourceUrl} target="_blank" rel="noreferrer">
                      {isSeneddTvUrl(readerDetail.sourceUrl) ? t("watch_video") : t("official_source")} <ExternalIcon />
                    </a>
                  </div>
                ) : null}
              </div>

              {readerLoading ? (
                <div className="text-sm text-muted">{t("loading")}</div>
              ) : readerError ? (
                <div className="alert alert--danger text-sm">{readerError}</div>
              ) : readerDetail ? (
                <>
                  {(readerLang === "cy" ? readerDetail.fullTextCy : readerDetail.fullTextEn) ? (
                    <div className="reader-text">
                      {(readerLang === "cy" ? readerDetail.fullTextCy : readerDetail.fullTextEn) ?? ""}
                    </div>
                  ) : (readerLang === "cy" ? readerDetail.fullTextEn : readerDetail.fullTextCy) ? (
                    <>
                      <div className="alert alert--info text-sm" style={{ marginBottom: 10 }}>
                        {t("full_text_fallback_other_language")}
                      </div>
                      <div className="reader-text">
                        {(readerLang === "cy" ? readerDetail.fullTextEn : readerDetail.fullTextCy) ?? ""}
                      </div>
                    </>
                  ) : (
                    <div className="alert alert--warn text-sm">{t("full_text_unavailable")}</div>
                  )}
                </>
              ) : (
                <div className="text-sm text-muted">—</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
