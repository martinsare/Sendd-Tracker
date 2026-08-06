"use client";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { I18nProvider } from "@/contexts/I18nContext";
import { ToastProvider } from "@/contexts/ToastContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <I18nProvider>
        <ToastProvider>
          {children}
        </ToastProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
