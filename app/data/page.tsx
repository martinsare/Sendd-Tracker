"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/contexts/I18nContext";
import { LoadingSpinner } from "@/components/Logo";
import * as api from "@/lib/api";

function ExternalIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function statusBadge(status: "available" | "partial" | "not_available", label: string) {
  const variant = status === "available" ? "ok" : status === "partial" ? "warn" : "danger";
  return <span className={`badge badge--${variant}`}>{label}</span>;
}

export default function DataAvailabilityPage() {
  const { lang, t } = useI18n();
  const [data, setData] = useState<api.DataAvailabilityResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getDataAvailability()
      .then(setData)
      .catch((e) => setError(String((e as Error)?.message ?? e)));
  }, []);

  return (
    <div className="page-wrapper">
      <div className="container" style={{ paddingTop: 32, paddingBottom: 56 }}>
        <div className="stack stack--24">

          {/* Top Breadcrumb */}
          <div>
            <Link href="/" className="btn btn--ghost btn--sm">
              <BackIcon /> {t("nav_home")}
            </Link>
          </div>

          {/* Page Hero */}
          <div>
            <div className="badge badge--live" style={{ marginBottom: 8 }}>
              <span className="badge-live-pulse" />
              Civic Transparency & Provenance
            </div>
            <h1 style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.4rem)", fontWeight: 800, lineHeight: 1.2, letterSpacing: "-0.02em" }}>
              {t("data_title")}
            </h1>
            <p className="text-muted" style={{ maxWidth: 680, marginTop: 8, fontSize: "14.5px", lineHeight: 1.65 }}>
              {t("data_help")}
            </p>
          </div>

          {/* Overview Metric Ribbon */}
          <div className="metric-ribbon" style={{ marginTop: 4 }}>
            <div className="metric-card">
              <div className="metric-card__value">4 / 4</div>
              <div className="metric-card__label">Core Data Metrics</div>
              <div className="metric-card__sub">Standardized tracking coverage</div>
            </div>

            <div className="metric-card">
              <div className="metric-card__value">100%</div>
              <div className="metric-card__label">Senedd Verifiable</div>
              <div className="metric-card__sub">Direct links to official Hansard/XML</div>
            </div>

            <div className="metric-card">
              <div className="metric-card__value" style={{ color: "var(--ok)" }}>Bilingual</div>
              <div className="metric-card__label">Language Standards</div>
              <div className="metric-card__sub">English & Cymraeg authentic text</div>
            </div>

            <div className="metric-card">
              <div className="metric-card__value" style={{ color: "var(--info)" }}>Live</div>
              <div className="metric-card__label">API Ingestion</div>
              <div className="metric-card__sub">TWFY API & Senedd XML Feed</div>
            </div>
          </div>

          {error && <div className="alert alert--danger">{error}</div>}

          {/* Metrics List */}
          <section className="stack stack--16">
            <h2 style={{ fontSize: "1.25rem", fontWeight: 800 }}>{t("data_metrics_heading")}</h2>

            {!data ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 200, gap: 12 }}>
                <LoadingSpinner size={40} label={t("loading")} />
                <span className="text-muted text-sm">{t("loading")}</span>
              </div>
            ) : (
              <div className="stack stack--12">
                {data.metrics.map((m) => (
                  <article className="data-metric-card" key={m.id}>
                    <div className="data-metric-card__header">
                      <h3 className="data-metric-card__name">{m.label[lang]}</h3>
                      {statusBadge(
                        m.status,
                        m.status === "available"
                          ? t("status_available")
                          : m.status === "partial"
                            ? t("status_partial")
                            : t("status_not_available")
                      )}
                    </div>

                    <p className="data-metric-card__desc">{m.explanation[lang]}</p>

                    {m.sourceLinks.length > 0 && (
                      <div className="data-metric-card__links">
                        <span className="text-xs text-muted" style={{ fontWeight: 600 }}>Sources:</span>
                        {m.sourceLinks.map((s) => (
                          <a key={s.url} className="link-pill" href={s.url} target="_blank" rel="noreferrer">
                            {s.label} <ExternalIcon />
                          </a>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* Methodology & Context Card */}
          <section>
            <div className="card" style={{ padding: "24px 28px" }}>
              <h2 className="card__title" style={{ fontSize: "1.15rem", marginBottom: 10 }}>{t("why_matters_title")}</h2>
              <p className="text-muted" style={{ fontSize: "14px", lineHeight: 1.7, maxWidth: 840 }}>
                {t("why_matters_body")}
              </p>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
