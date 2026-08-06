"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/contexts/I18nContext";
import { useTheme } from "@/contexts/ThemeContext";
import { AppLogo } from "@/components/Logo";

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="4.22" y1="4.22" x2="7.05" y2="7.05" />
      <line x1="16.95" y1="16.95" x2="19.78" y2="19.78" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
      <line x1="4.22" y1="19.78" x2="7.05" y2="16.95" />
      <line x1="16.95" y1="7.05" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

function BurgerIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function ScrollToTop() {
  const [visible, setVisible] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 320);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      className="scroll-top-btn"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label={t("scroll_to_top")}
    >
      <ChevronUpIcon /> {t("scroll_to_top")}
    </button>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const { lang, setLang, t } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const menuRef = useRef<HTMLElement>(null);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen]);

  return (
    <div className="page-wrapper">
      <nav className="nav" ref={menuRef} style={{ position: "relative" }}>
        <div className="container">
          <div className="nav__inner">
            <Link href="/" className="nav__brand">
              <AppLogo size={32} />
              <div className="nav__brand-text">
                <span className="nav__brand-name">{t("app_title")}</span>
                <span className="nav__brand-sub">{t("app_subtitle_short")}</span>
              </div>
            </Link>

            <div className="nav__links">
              <Link href="/" className={`nav__link${pathname === "/" ? " active" : ""}`}>
                {t("nav_home")}
              </Link>
              <Link href="/data" className={`nav__link${pathname === "/data" ? " active" : ""}`}>
                {t("nav_data")}
              </Link>
            </div>

            <div className="nav__actions">
              <select
                className="nav__lang-select"
                value={lang}
                onChange={(e) => setLang(e.target.value === "cy" ? "cy" : "en")}
                aria-label="Language"
              >
                <option value="en">{t("lang_en")}</option>
                <option value="cy">{t("lang_cy")}</option>
              </select>
              <button
                className="theme-btn"
                onClick={toggleTheme}
                aria-label="Toggle theme"
                title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {theme === "dark" ? <SunIcon /> : <MoonIcon />}
              </button>
              <button
                className="nav__burger"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="Toggle menu"
                aria-expanded={menuOpen}
              >
                <BurgerIcon open={menuOpen} />
              </button>
            </div>
          </div>
        </div>

        <div className={`nav__mobile-menu${menuOpen ? " open" : ""}`}>
          <Link href="/" className={`nav__mobile-link${pathname === "/" ? " active" : ""}`}>
            {t("nav_home")}
          </Link>
          <Link href="/data" className={`nav__mobile-link${pathname === "/data" ? " active" : ""}`}>
            {t("nav_data")}
          </Link>
          <div className="nav__mobile-divider" />
          <div className="nav__mobile-actions">
            <select
              className="nav__lang-select"
              value={lang}
              onChange={(e) => { setLang(e.target.value === "cy" ? "cy" : "en"); setMenuOpen(false); }}
              aria-label="Language"
            >
              <option value="en">{t("lang_en")}</option>
              <option value="cy">{t("lang_cy")}</option>
            </select>
            <button
              className="theme-btn"
              onClick={() => { toggleTheme(); setMenuOpen(false); }}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </div>
      </nav>

      <main style={{ flex: 1 }}>
        {children}
      </main>

      <footer className="footer">
        <div className="container">
          <div className="footer__inner">
            <p className="footer__disclaimer">{t("footer_disclaimer")}</p>
            <div className="footer__links">
              <Link href="/data" className="footer__link">{t("nav_data")}</Link>
            </div>
          </div>
        </div>
      </footer>

      <ScrollToTop />
    </div>
  );
}
