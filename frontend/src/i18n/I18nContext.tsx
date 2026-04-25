import React, { createContext, useCallback, useContext, useState } from "react";
import { cyStrings, enStrings } from "./translations";

export type Lang = "en" | "cy";

type I18nContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);
const STORAGE_KEY = "senedd_tracker_lang";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === "cy" ? "cy" : "en";
  });

  const setLang = useCallback((next: Lang) => {
    localStorage.setItem(STORAGE_KEY, next);
    setLangState(next);
  }, []);

  const t = useCallback(
    (key: string): string => {
      const enText = enStrings[key] ?? key;
      if (lang === "cy") {
        return cyStrings[key] ?? enText;
      }
      return enText;
    },
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
