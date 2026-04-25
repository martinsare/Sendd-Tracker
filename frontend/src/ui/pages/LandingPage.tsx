import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../../i18n/I18nContext";
import * as api from "../../lib/api";

const HISTORY_KEY = "snt_recent_searches";
const MAX_HISTORY = 5;

function loadHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]"); } catch { return []; }
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

export default function LandingPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<api.SearchResponse | null>(null);
  const [history, setHistory] = useState<string[]>(loadHistory);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const onSearch = useCallback(async (query = q.trim()) => {
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
  }, [q, navigate]);

  return (
    <>
      <section className="hero">
        <div className="container">
          <div className="hero__eyebrow">Wales · Cymru</div>
          <h1 className="hero__title">
            {t("hero_title_a")} <span>{t("hero_title_b")}</span>
          </h1>
          <p className="hero__desc">{t("hero_desc")}</p>

          <div className="hero__search">
            <input
              ref={inputRef}
              className="input"
              value={q}
              placeholder={t("search_placeholder")}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onSearch(); }}
              aria-label={t("search_title")}
            />
            <button className="btn btn--primary" onClick={() => onSearch()} disabled={loading}>
              {loading ? t("loading_short") : <><SearchIcon />{t("search_button")}</>}
            </button>
          </div>

          {history.length > 0 && !results && !loading && (
            <div className="recent-searches">
              <span className="recent-searches__label">{t("recent_searches")}</span>
              {history.map((item) => (
                <button
                  key={item}
                  className="recent-chip"
                  onClick={() => { setQ(item); onSearch(item); }}
                  title={item}
                >
                  <ClockIcon /> {item}
                </button>
              ))}
              <button
                className="recent-clear-btn"
                onClick={() => { clearHistory(); setHistory([]); }}
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
      </section>

      {results && (
        <section className="results-section">
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
            <div className="features__grid">
              <div className="feature-card">
                <div className="feature-card__icon">📋</div>
                <div className="feature-card__title">{t("feature1_title")}</div>
                <div className="feature-card__desc">{t("feature1_desc")}</div>
              </div>
              <div className="feature-card">
                <div className="feature-card__icon">🔍</div>
                <div className="feature-card__title">{t("feature2_title")}</div>
                <div className="feature-card__desc">{t("feature2_desc")}</div>
              </div>
              <div className="feature-card">
                <div className="feature-card__icon">🏴󠁧󠁢󠁷󠁬󠁳󠁿</div>
                <div className="feature-card__title">{t("feature3_title")}</div>
                <div className="feature-card__desc">{t("feature3_desc")}</div>
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
