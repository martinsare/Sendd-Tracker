import React from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../../i18n/I18nContext";

export default function NotFoundPage() {
  const { t } = useI18n();
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400, textAlign: "center", padding: 24 }}>
      <div style={{ fontSize: 72, fontWeight: 900, color: "var(--accent)", lineHeight: 1, marginBottom: 16 }}>404</div>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text)", marginBottom: 10 }}>{t("page_not_found")}</h1>
      <p style={{ color: "var(--text2)", fontSize: 15, marginBottom: 28 }}>{t("not_found_desc")}</p>
      <Link to="/" className="btn btn--primary">{t("go_home")}</Link>
    </div>
  );
}
