"use client";
import Link from "next/link";
import { useI18n } from "@/contexts/I18nContext";
import { useTheme } from "@/contexts/ThemeContext";
import Logo from "@/components/Logo";

export default function Shell({ children }: { children: React.ReactNode }) {
  const { t, locale, setLocale } = useI18n();
  const { theme, toggle } = useTheme();

  return (
    <>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <header className="site-header">
        <div className="site-header__inner container">
          <Logo />
          <nav className="site-nav" aria-label="Site navigation">
            <Link href="/" className="site-nav__link">{t("navHome")}</Link>
            <Link href="/data" className="site-nav__link">{t("navData")}</Link>
          </nav>
          <div className="site-header__controls">
            <button
              className="btn btn--ghost btn--sm"
              aria-label="Toggle language"
              onClick={() => setLocale(locale === "en" ? "cy" : "en")}
            >
              {t("langToggle")}
            </button>
            <button
              className="btn btn--ghost btn--sm"
              aria-label="Toggle colour scheme"
              onClick={toggle}
            >
              {theme === "light" ? "🌙" : "☀️"}
            </button>
          </div>
        </div>
      </header>

      <main id="main-content" className="site-main">
        <div className="container">
          {children}
        </div>
      </main>

      <footer className="site-footer">
        <div className="container">
          <p className="site-footer__disclaimer">{t("footerDisclaimer")}</p>
        </div>
      </footer>
    </>
  );
}
