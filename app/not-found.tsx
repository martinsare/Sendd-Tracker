"use client";
import Link from "next/link";
import { useI18n } from "@/contexts/I18nContext";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="not-found">
      <h1>404</h1>
      <p>{t("errorNotFound")}</p>
      <Link href="/" className="btn btn--primary">{t("errorGoHome")}</Link>
    </div>
  );
}
