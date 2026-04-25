import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useI18n } from "../../i18n/I18nContext";
import { MemberAvatar } from "../MemberAvatar";
import * as api from "../../lib/api";

const HISTORY_KEY = "snt_recent_searches";
const MAX_HISTORY = 5;

function loadHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveHistory(q: string) {
  const hist = [q, ...loadHistory().filter((x) => x !== q)].slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
}

function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function SourceIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="16" y2="17" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-5" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function StepBadge({ n }: { n: 1 | 2 | 3 }) {
  return (
    <div className="step-badge" aria-hidden="true">
      {n}
    </div>
  );
}

export default function LandingPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<api.SearchResponse | null>(null);
  const [history, setHistory] = useState<string[]>(loadHistory);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (results && results.members.length > 0) {
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    }
  }, [results]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "/") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const onSearch = useCallback(
    async (query = q.trim()) => {
      if (!query) return;
      setError(null);
      setResults(null);
      setLoading(true);
      try {
        const res = await api.search(query);
        saveHistory(query);
        setHistory(loadHistory());
        if (res.members.length === 1) {
          sessionStorage.setItem(`member:${res.members[0].id}`, JSON.stringify(res.members[0]));
          navigate(`/member/${encodeURIComponent(res.members[0].id)}`);
          return;
        }
        setResults(res);
      } catch (e: any) {
        setError(String(e?.message ?? e));
      } finally {
        setLoading(false);
      }
    },
    [q, navigate],
  );

  return (
    <>
      <section className="hero hero--bilingual" aria-label="Search">
        <div className="hero__panels">
          <div className="hero__panel hero__panel--cy" aria-hidden="true">
            <span className="hero__panel-lang">CY</span>
            <p className="hero__panel-title">
              Dilynwch eich<br />
              <strong>Aelod o'r<br />Senedd</strong>
            </p>
            <p className="hero__panel-sub">Cofnod plenary swyddogol</p>
          </div>

          <div className="hero__divider" aria-hidden="true">
            <span className="hero__divider-label">SENEDD<br />TRACKER</span>
          </div>

          <div className="hero__panel hero__panel--en" aria-hidden="true">
            <span className="hero__panel-lang">EN</span>
            <p className="hero__panel-title">
              Track your<br />
              <strong>Member of<br />the Senedd</strong>
            </p>
            <p className="hero__panel-sub">Official plenary record</p>
          </div>
        </div>

        <div className="hero__search-section">
          <div className="container">
            <div className="hero__search-card">
              <p className="hero__search-label">{t("search_title")}</p>
              <div className="hero__search hero__search--wide">
                <input
                  ref={inputRef}
                  className="input"
                  value={q}
                  placeholder={t("search_placeholder")}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onSearch();
                  }}
                  aria-label={t("search_title")}
                />
                <button className="btn btn--primary" onClick={() => onSearch()} disabled={loading}>
                  {loading ? (
                    t("loading_short")
                  ) : (
                    <>
                      <SearchIcon />
                      {t("search_button")}
                    </>
                  )}
                </button>
              </div>
              <p className="hero__search-hint text-muted text-sm">{t("search_help")}</p>

              {history.length > 0 && !results && !loading && (
                <div className="recent-searches">
                  <span className="recent-searches__label">{t("recent_searches")}</span>
                  {history.map((item) => (
                    <button
                      key={item}
                      className="recent-chip"
                      onClick={() => {
                        setQ(item);
                        onSearch(item);
                      }}
                      title={item}
                    >
                      <ClockIcon /> {item}
                    </button>
                  ))}
                  <button
                    className="recent-clear-btn"
                    onClick={() => {
                      clearHistory();
                      setHistory([]);
                    }}
                  >
                    {t("clear_history")}
                  </button>
                </div>
              )}

              {error && (
                <div style={{ marginTop: 16 }}>
                  <div className="alert alert--danger">{error}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {results && (
        <section className="results-section" ref={resultsRef}>
          <div className="container">
            <div className="stack stack--16">
              <div>
                <h2 className="section-title">{t("results_title")}</h2>
                <p className="section-sub text-muted text-sm">
                  {t("source_label")}:{" "}
                  <a href={results.sourceUrl} target="_blank" rel="noreferrer">
                    {new URL(results.sourceUrl).host}
                  </a>{" "}
                  · {results.fromCache ? t("cache_cached") : t("cache_live")}
                </p>
              </div>

              {results.members.length === 0 ? (
                <div className="empty-state">{t("results_empty")}</div>
              ) : (
                <div className="stack stack--8">
                  {results.members.map((m) => (
                    <div className="member-item" key={m.id}>
                      <div className="member-item__left">
                        <MemberAvatar name={m.name} imageUrl={m.imageUrl} size={44} />
                        <div>
                          <div className="member-item__name">{m.name}</div>
                          <div className="member-item__meta">
                            {[
                              m.party ? `${t("member_party")}: ${m.party}` : null,
                              m.areaName ? `${t("member_area")}: ${m.areaName}` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        </div>
                      </div>
                      <button
                        className="btn btn--ghost btn--sm"
                        onClick={() => {
                          sessionStorage.setItem(`member:${m.id}`, JSON.stringify(m));
                          navigate(`/member/${encodeURIComponent(m.id)}`);
                        }}
                      >
                        {t("view_dashboard")} <ArrowIcon />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {!results && (
        <section className="features">
          <div className="container">
            <div className="stack stack--16">
              <div>
                <h2 className="section-title">{t("landing_steps_title")}</h2>
                <p className="section-sub">{t("landing_steps_desc")}</p>
              </div>

              <div className="steps-grid">
                <div className="step-card">
                  <div className="step-card__head">
                    <StepBadge n={1} />
                    <div className="step-card__title">{t("landing_step1_title")}</div>
                  </div>
                  <div className="step-card__desc">{t("landing_step1_desc")}</div>
                </div>
                <div className="step-card">
                  <div className="step-card__head">
                    <StepBadge n={2} />
                    <div className="step-card__title">{t("landing_step2_title")}</div>
                  </div>
                  <div className="step-card__desc">{t("landing_step2_desc")}</div>
                </div>
                <div className="step-card">
                  <div className="step-card__head">
                    <StepBadge n={3} />
                    <div className="step-card__title">{t("landing_step3_title")}</div>
                  </div>
                  <div className="step-card__desc">{t("landing_step3_desc")}</div>
                </div>
              </div>

              <div>
                <h2 className="section-title">{t("landing_coverage_title")}</h2>
                <p className="section-sub">{t("landing_coverage_desc")}</p>
              </div>

              <div className="features__grid">
                <div className="feature-card">
                  <div className="feature-card__icon"><SourceIcon /></div>
                  <div className="feature-card__title">{t("feature1_title")}</div>
                  <div className="feature-card__desc">{t("feature1_desc")}</div>
                </div>
                <div className="feature-card">
                  <div className="feature-card__icon"><ShieldIcon /></div>
                  <div className="feature-card__title">{t("feature2_title")}</div>
                  <div className="feature-card__desc">{t("feature2_desc")}</div>
                </div>
                <div className="feature-card">
                  <div className="feature-card__icon"><GlobeIcon /></div>
                  <div className="feature-card__title">{t("feature3_title")}</div>
                  <div className="feature-card__desc">{t("feature3_desc")}</div>
                </div>
              </div>

              <div className="card">
                <div className="card__header">
                  <div className="card__title">{t("landing_verify_title")}</div>
                  <Link className="btn btn--ghost btn--sm" to="/data">
                    {t("nav_data")} <ArrowIcon />
                  </Link>
                </div>
                <div className="text-muted" style={{ lineHeight: 1.7 }}>
                  {t("landing_verify_body")}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
