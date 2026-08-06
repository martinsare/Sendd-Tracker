"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import * as api from "@/lib/api";

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
    <div className="container" style={{ paddingTop: 40, paddingBottom: 48 }}>
      <div className="stack stack--24">

        <div>
          <h1 className="hero__title" style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", marginBottom: 10 }}>
            {t("data_title")}
          </h1>
          <p className="text-muted" style={{ maxWidth: 600, lineHeight: 1.7 }}>{t("data_help")}</p>
        </div>

        {error && <div className="alert alert--danger">{error}</div>}

        <section>
          <h2 className="section-title">{t("data_metrics_heading")}</h2>

          {!data ? (
            <div className="loading-dots">{t("loading")}</div>
          ) : (
            <div className="stack stack--12">
              {data.metrics.map((m) => (
                <div className="data-metric" key={m.id}>
                  <div className="data-metric__header">
                    <div className="data-metric__name">{m.label[lang]}</div>
                    {statusBadge(
                      m.status,
                      m.status === "available"
                        ? t("status_available")
                        : m.status === "partial"
                          ? t("status_partial")
                          : t("status_not_available")
                    )}
                  </div>
                  <p className="data-metric__explanation">{m.explanation[lang]}</p>
                  {m.sourceLinks.length > 0 && (
                    <div className="data-metric__links">
                      {m.sourceLinks.map((s) => (
                        <a key={s.url} className="link-pill" href={s.url} target="_blank" rel="noreferrer">
                          {s.label} ↗
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="card">
            <h2 className="card__title" style={{ marginBottom: 12 }}>{t("why_matters_title")}</h2>
            <p className="text-muted" style={{ fontSize: 14, lineHeight: 1.7 }}>{t("why_matters_body")}</p>
          </div>
        </section>

      </div>
    </div>
  );
}
