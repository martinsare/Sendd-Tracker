import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useI18n } from "../../i18n/I18nContext";
import { LoadingSpinner } from "../Logo";
import { useToast } from "../Toast";
import * as api from "../../lib/api";

type MsLite = api.SearchResponse["members"][number];

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

function SpeechIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function VoteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

interface VoteParsed {
  memberResult: "for" | "against" | "abstain" | null;
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

function VoteResultCard({ parsed }: { parsed: VoteParsed }) {
  const total = parsed.totals ? parsed.totals.for + parsed.totals.against + parsed.totals.abstain : 0;
  const forPct = total > 0 ? (parsed.totals!.for / total) * 100 : 0;
  const againstPct = total > 0 ? (parsed.totals!.against / total) * 100 : 0;
  const abstainPct = total > 0 ? (parsed.totals!.abstain / total) * 100 : 0;

  const memberClass =
    parsed.memberResult === "for" ? "vote-verdict--for"
    : parsed.memberResult === "against" ? "vote-verdict--against"
    : "vote-verdict--abstain";

  const memberLabel =
    parsed.memberResult === "for" ? "Voted For"
    : parsed.memberResult === "against" ? "Voted Against"
    : parsed.memberResult === "abstain" ? "Abstained"
    : null;

  return (
    <div className="vote-result-card">
      <div className="vote-result-card__top">
        {memberLabel && (
          <span className={`vote-verdict ${memberClass}`}>{memberLabel}</span>
        )}
        {parsed.overall && (
          <span className="vote-result-card__overall">{parsed.overall}</span>
        )}
      </div>
      {parsed.totals && total > 0 && (
        <div className="vote-result-card__tally">
          <div className="vote-tally-bar">
            {forPct > 0 && <div className="vote-tally-bar__seg vote-tally-bar__seg--for" style={{ width: `${forPct}%` }} />}
            {abstainPct > 0 && <div className="vote-tally-bar__seg vote-tally-bar__seg--abstain" style={{ width: `${abstainPct}%` }} />}
            {againstPct > 0 && <div className="vote-tally-bar__seg vote-tally-bar__seg--against" style={{ width: `${againstPct}%` }} />}
          </div>
          <div className="vote-tally-labels">
            <span className="vote-tally-labels__for">
              <span className="vote-tally-dot vote-tally-dot--for" />
              For <strong>{parsed.totals.for}</strong>
            </span>
            {parsed.totals.abstain > 0 && (
              <span className="vote-tally-labels__abstain">
                <span className="vote-tally-dot vote-tally-dot--abstain" />
                Abstain <strong>{parsed.totals.abstain}</strong>
              </span>
            )}
            <span className="vote-tally-labels__against">
              <span className="vote-tally-dot vote-tally-dot--against" />
              Against <strong>{parsed.totals.against}</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
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
  } catch { return null; }
}

function recordPageUrl(meetingId: number) {
  return `https://record.senedd.wales/Plenary/${meetingId}`;
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

export default function MemberPage() {
  const { id } = useParams();
  const { lang, t } = useI18n();
  const toast = useToast();
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
    try { return JSON.parse(raw) as MsLite; } catch { return null; }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoadingData(true);
    Promise.all([
      api.getRecentPlenaryExports(8).then(setExports).catch(() => setExports(null)),
      api.getDataAvailability().then(setAvailability).catch(() => setAvailability(null)),
      api.getMemberParticipation(id).then(setParticipation).catch(() => setParticipation(null)),
    ]).finally(() => setLoadingData(false));
  }, [id]);

  if (!id) return null;

  const realSpeeches = participation?.real?.items?.filter((i) => i.kind === "speech") ?? [];
  const realVotes = participation?.real?.items?.filter((i) => i.kind === "vote") ?? [];
  const uniqueTimestamps = new Set(realSpeeches.map((i) => i.occurredAt)).size;
  const showTimestampNote = realSpeeches.length >= 2 && uniqueTimestamps === 1;

  if (loadingData) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 320, gap: 16 }}>
        <LoadingSpinner size={56} label={t("loading")} />
        <span className="text-muted text-sm">{t("loading")}</span>
      </div>
    );
  }

  return (
    <>
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
            >
              <ShareIcon /> {t("copy_link")}
            </button>
          </div>

          {member ? (
            <>
              <h1 className="member-hero__name">{member.name}</h1>
              <div className="member-hero__meta">
                {member.party && (
                  <span className="badge badge--neutral">{member.party}</span>
                )}
                {member.areaName && (
                  <span className="badge badge--neutral">{member.areaName}</span>
                )}
                {member.profileUrl && (
                  <a className="link-pill" href={member.profileUrl} target="_blank" rel="noreferrer">
                    {t("member_profile")} <ExternalIcon />
                  </a>
                )}
              </div>
            </>
          ) : (
            <p className="text-muted">{t("member_missing")}</p>
          )}
        </div>
      </div>

      <div className="container" style={{ paddingTop: 24, paddingBottom: 40 }}>
        <div className="stack stack--24">

          {participation?.summary && (
            <section>
              <div className="row row--12" style={{ marginBottom: 16, justifyContent: "space-between" }}>
                <h2 className="section-title" style={{ marginBottom: 0 }}>{t("activity_summary")}</h2>
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

              {participation.summary.topicBreakdown?.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <h3 className="section-title" style={{ fontSize: "1rem", marginBottom: 10 }}>{t("topic_breakdown")}</h3>
                  <div className="stack stack--4">
                    {participation.summary.topicBreakdown.slice(0, 9).map((x) => (
                      <div className="topic-row" key={x.topic}>
                        <span className="topic-row__name">{x.topic}</span>
                        <span className="badge badge--neutral">{x.count}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-muted" style={{ marginTop: 8 }}>{t("topic_note")}</div>
                </div>
              )}
            </section>
          )}

          <section className="parl-section">
            <div className="parl-section__head">
              <div className="parl-section__head-left">
                <span className="parl-section__icon parl-section__icon--speech"><SpeechIcon /></span>
                <h2 className="parl-section__title">{t("real_spoken_title")}</h2>
                <span className="badge badge--warn">{t("status_partial")}</span>
              </div>
            </div>
            <p className="parl-section__desc">{t("real_spoken_desc")}</p>

            {participation?.real?.partial && (
              <div className="alert alert--warn text-sm" style={{ marginBottom: 12 }}>{t("data_partial_warning")}</div>
            )}
            {showTimestampNote && (
              <div className="alert alert--info text-sm" style={{ marginBottom: 12 }}>{t("timestamp_note")}</div>
            )}
            {participation?.real?.dataNotes?.length ? (
              <div className="stack stack--4" style={{ marginBottom: 12 }}>
                {participation.real.dataNotes
                  .map(noteKeyToTranslationKey)
                  .filter(Boolean)
                  .map((k) => (
                    <div className="text-sm text-muted" key={k as string}>• {t(k as string)}</div>
                  ))}
              </div>
            ) : null}

            {realSpeeches.length > 0 ? (
              <div className="parl-list">
                {realSpeeches
                  .slice()
                  .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
                  .map((it) => {
                    const meetingId = tryGetMeetingIdFromUrl(it.sourceUrl);
                    const snippet = (lang === "cy" ? it.snippetCy : it.snippetEn) ?? it.snippetEn;
                    return (
                      <div className="parl-item parl-item--speech" key={it.id}>
                        <div className="parl-item__meta">
                          <span className="parl-item__date">{formatDate(it.occurredAt)}</span>
                          {confidenceBadge(
                            it.confidence,
                            it.confidence === "high" ? t("confidence_high")
                              : it.confidence === "medium" ? t("confidence_medium")
                              : t("confidence_low")
                          )}
                        </div>
                        <h3 className="parl-item__title">{it.title}</h3>
                        {snippet && (
                          <blockquote className="parl-item__quote">{snippet}</blockquote>
                        )}
                        <div className="parl-item__actions">
                          <button
                            className="parl-item__read-btn"
                            onClick={async () => {
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
                            }}
                          >
                            {t("read_full")}
                          </button>
                          {meetingId ? (
                            <a className="parl-item__source-link" href={recordPageUrl(meetingId)} target="_blank" rel="noreferrer">
                              {t("view_record_page")} <ExternalIcon />
                            </a>
                          ) : (
                            <a className="parl-item__source-link" href={it.sourceUrl} target="_blank" rel="noreferrer">
                              {t("source_label")} <ExternalIcon />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="parl-empty">{t("no_verified_votes")}</div>
            )}
          </section>

          <section className="parl-section">
            <div className="parl-section__head">
              <div className="parl-section__head-left">
                <span className="parl-section__icon parl-section__icon--vote"><VoteIcon /></span>
                <h2 className="parl-section__title">{t("real_votes_title")}</h2>
                <span className="badge badge--warn">{t("status_partial")}</span>
              </div>
            </div>
            <p className="parl-section__desc">{t("real_votes_desc")}</p>

            {participation?.real?.partial && (
              <div className="alert alert--warn text-sm" style={{ marginBottom: 12 }}>{t("data_partial_warning")}</div>
            )}

            {realVotes.length > 0 ? (
              <div className="parl-list">
                {realVotes
                  .slice()
                  .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
                  .map((it) => {
                    const meetingId = tryGetMeetingIdFromUrl(it.sourceUrl);
                    const snippet = (lang === "cy" ? it.snippetCy : it.snippetEn) ?? it.snippetEn;
                    return (
                      <div className="parl-item parl-item--vote" key={it.id}>
                        <div className="parl-item__meta">
                          <span className="parl-item__date">{formatDate(it.occurredAt)}</span>
                          {confidenceBadge(
                            it.confidence,
                            it.confidence === "high" ? t("confidence_high")
                              : it.confidence === "medium" ? t("confidence_medium")
                              : t("confidence_low")
                          )}
                        </div>
                        <h3 className="parl-item__title">{it.title}</h3>
                        <VoteResultCard parsed={parseVoteSnippet(snippet)} />
                        <div className="parl-item__actions">
                          {meetingId ? (
                            <a className="parl-item__source-link" href={recordPageUrl(meetingId)} target="_blank" rel="noreferrer">
                              {t("view_record_page")} <ExternalIcon />
                            </a>
                          ) : (
                            <a className="parl-item__source-link" href={it.sourceUrl} target="_blank" rel="noreferrer">
                              {t("source_label")} <ExternalIcon />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="parl-empty">{t("no_verified_participation")}</div>
            )}
          </section>

          <section>
            <div style={{ marginBottom: 16 }}>
              <div className="row row--8" style={{ marginBottom: 4 }}>
                <h2 className="section-title" style={{ marginBottom: 0 }}>{t("record_exports_title")}</h2>
                {availability && (() => {
                  const s = availability.metrics.find((m) => m.id === "spoken_contributions")?.status ?? "partial";
                  const variant = s === "available" ? "ok" : s === "partial" ? "warn" : "danger";
                  const label = s === "available" ? t("status_available") : s === "partial" ? t("status_partial") : t("status_not_available");
                  return <span className={`badge badge--${variant}`}>{label}</span>;
                })()}
              </div>
              <p className="section-sub text-muted text-sm">{t("exports_desc")}</p>
            </div>

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
                    <div className="card" key={`${it.title}-${idx}`} style={{ padding: "16px" }}>
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
              <div className="empty-state">{t("record_exports_empty")}</div>
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
              <button className="btn btn--ghost btn--sm" onClick={() => setReaderOpen(false)}>
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
                      {t("official_source")} <ExternalIcon />
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
