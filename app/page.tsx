"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useI18n } from "@/contexts/I18nContext";
import { useToast } from "@/contexts/ToastContext";
import MemberAvatar from "@/components/MemberAvatar";
import { searchMembers, type SearchResult, type Member } from "@/lib/api";

const HISTORY_KEY = "senedd_tracker_history";
const MAX_HISTORY = 8;

function loadHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function saveToHistory(q: string) {
  if (typeof window === "undefined") return;
  const prev = loadHistory().filter((x) => x !== q).slice(0, MAX_HISTORY - 1);
  localStorage.setItem(HISTORY_KEY, JSON.stringify([q, ...prev]));
}

function clearHistory() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(HISTORY_KEY);
}

function PartyBadge({ party }: { party?: string | null }) {
  if (!party) return null;
  return <span className="party-badge">{party}</span>;
}

function MemberCard({ member }: { member: Member }) {
  return (
    <Link href={`/member/${encodeURIComponent(member.id)}`} className="member-card">
      <MemberAvatar
        memberId={member.id}
        name={member.name}
        imageUrl={member.imageUrl}
        size="md"
      />
      <div className="member-card__info">
        <span className="member-card__name">{member.name}</span>
        <span className="member-card__area">{member.areaName ?? ""}</span>
        <PartyBadge party={member.party} />
      </div>
    </Link>
  );
}

export default function HomePage() {
  const { t } = useI18n();
  const { addToast } = useToast();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHistory(loadHistory());
    inputRef.current?.focus();
  }, []);

  const doSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) return;
      setLoading(true);
      setResult(null);
      try {
        const res = await searchMembers(q.trim());
        setResult(res);
        saveToHistory(q.trim());
        setHistory(loadHistory());
      } catch (e: unknown) {
        addToast(t("errorUpstream"), "error");
        console.error(e);
      } finally {
        setLoading(false);
      }
    },
    [t, addToast]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query);
  };

  const handleHistoryClick = (q: string) => {
    setQuery(q);
    doSearch(q);
  };

  const handleClearHistory = () => {
    clearHistory();
    setHistory([]);
  };

  return (
    <div className="landing-page">
      <section className="hero">
        <h1 className="hero__title">{t("tagline")}</h1>
        <form className="search-form" onSubmit={handleSubmit} role="search">
          <div className="search-form__row">
            <input
              ref={inputRef}
              className="search-input"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchPlaceholder")}
              disabled={loading}
            />
            <button
              type="submit"
              className="btn btn--primary"
              disabled={loading || !query.trim()}
              aria-busy={loading}
            >
              {loading ? t("searching") : t("searchButton")}
            </button>
          </div>
        </form>

        {history.length > 0 && !result && !loading && (
          <div className="search-history">
            <span className="search-history__label">{t("recentSearches")}:</span>
            {history.map((q) => (
              <button
                key={q}
                className="btn btn--ghost btn--sm search-history__item"
                onClick={() => handleHistoryClick(q)}
              >
                {q}
              </button>
            ))}
            <button className="btn btn--ghost btn--sm" onClick={handleClearHistory}>
              {t("clearHistory")}
            </button>
          </div>
        )}
      </section>

      {loading && (
        <div className="loading-bar" role="status" aria-label={t("loading")}>
          <span className="loading-bar__inner" />
        </div>
      )}

      {result && (
        <section className="results-section" aria-live="polite">
          <div className="results-header">
            <h2 className="results-header__title">
              {result.members.length === 0
                ? t("noResults")
                : t("yourMSs")}
              {result.areas?.constituency || result.areas?.region ? (
                <span className="results-header__subtitle">
                  {" "}{t("for")}{" "}
                  <strong>
                    {result.areas?.constituency ?? result.areas?.region}
                  </strong>
                </span>
              ) : null}
            </h2>
          </div>

          {result.notes?.map((note, i) => (
            <p key={i} className="results-note">{note}</p>
          ))}

          {result.members.length === 0 && (
            <p className="results-empty">{t("tryDifferent")}</p>
          )}

          <ul className="member-list" aria-label="Members of the Senedd">
            {result.members.map((m) => (
              <li key={m.id}>
                <MemberCard member={m} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
