"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { getDataAvailability, type AvailabilityMetric } from "@/lib/api";

function StatusPill({ status }: { status: AvailabilityMetric["status"] }) {
  const label =
    status === "available" ? "Available" :
    status === "partial" ? "Partial" : "Not available";
  return (
    <span className={`status-pill status-pill--${status}`} aria-label={`Status: ${label}`}>
      {label}
    </span>
  );
}

export default function DataPage() {
  const { t, locale } = useI18n();
  const [metrics, setMetrics] = useState<AvailabilityMetric[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDataAvailability()
      .then((r) => setMetrics(r.metrics))
      .catch((e: unknown) => setError(String((e as Error)?.message ?? e)));
  }, []);

  return (
    <div className="data-page">
      <h1 className="page-title">{t("dataAvailabilityTitle")}</h1>
      <p className="page-desc">{t("dataAvailabilityDesc")}</p>

      {error && <p className="error-message">{error}</p>}
      {!metrics && !error && <p className="loading-text">{t("loading")}</p>}

      {metrics && (
        <ul className="availability-list">
          {metrics.map((m) => (
            <li key={m.id} className="availability-item">
              <div className="availability-item__header">
                <h2 className="availability-item__label">
                  {locale === "cy" ? m.label.cy : m.label.en}
                </h2>
                <StatusPill status={m.status} />
              </div>
              <p className="availability-item__desc">
                {locale === "cy" ? m.explanation.cy : m.explanation.en}
              </p>
              {m.sourceLinks.length > 0 && (
                <ul className="source-links">
                  {m.sourceLinks.map((link) => (
                    <li key={link.url}>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="source-link"
                      >
                        {link.label} ↗
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
