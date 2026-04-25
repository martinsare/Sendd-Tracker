import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../../i18n/I18nContext";
import { MemberAvatar } from "../MemberAvatar";
import * as api from "../../lib/api";

export default function HomePage() {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<api.SearchResponse | null>(null);
  const navigate = useNavigate();

  const onSearch = async () => {
    setError(null);
    setResults(null);
    const query = q.trim();
    if (!query) return;
    setLoading(true);
    try {
      const res = await api.search(query);
      setResults(res);
      if (res.members.length === 1) {
        sessionStorage.setItem(`member:${res.members[0].id}`, JSON.stringify(res.members[0]));
        navigate(`/member/${encodeURIComponent(res.members[0].id)}`);
      }
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid">
      <div className="card">
        <h2>{t("search_title")}</h2>
        <div className="muted">{t("search_help")}</div>
        <div style={{ height: 12 }} />
        <div className="row">
          <input
            className="input"
            value={q}
            placeholder={t("search_placeholder")}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSearch();
            }}
          />
          <button className="btn" onClick={onSearch} disabled={loading}>
            {loading ? "…" : t("search_button")}
          </button>
        </div>
        {error ? (
          <div style={{ marginTop: 12 }} className="badge no">
            {error}
          </div>
        ) : null}
      </div>

      <div className="card">
        <h3>{t("results_title")}</h3>
        {!results ? <div className="muted">{t("results_empty")}</div> : null}

        {results ? (
          <>
            <div className="muted" style={{ marginTop: 6 }}>
              {t("source_label")}:{" "}
              <a href={results.sourceUrl} target="_blank" rel="noreferrer">
                {new URL(results.sourceUrl).host}
              </a>{" "}
              ({results.fromCache ? t("cache_cached") : t("cache_live")})
            </div>
            <div className="list">
              {results.members.map((m) => (
                <div className="listItem" key={m.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <MemberAvatar name={m.name} imageUrl={m.imageUrl} size={40} />
                      <div>
                        <div style={{ fontWeight: 800 }}>{m.name}</div>
                        <div className="muted" style={{ marginTop: 4 }}>
                          {m.party ? `${t("member_party")}: ${m.party}` : null}
                          {m.party && (m.areaName || m.areaType) ? " · " : null}
                          {m.areaName || m.areaType ? `${t("member_area")}: ${[m.areaName, m.areaType].filter(Boolean).join(" ")}` : null}
                        </div>
                      </div>
                    </div>
                    <button
                      className="btn"
                      onClick={() => {
                        sessionStorage.setItem(`member:${m.id}`, JSON.stringify(m));
                        navigate(`/member/${encodeURIComponent(m.id)}`);
                      }}
                    >
                      {t("member_card_title")}
                    </button>
                  </div>
                </div>
              ))}
              {results.members.length === 0 ? <div className="muted">{t("results_empty")}</div> : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
