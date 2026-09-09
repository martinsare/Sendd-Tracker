"use client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { I18nProvider } from "@/contexts/I18nContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { useMemo } from "react";

export default function Providers({ children }: { children: React.ReactNode }) {
  const convex = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL || "https://perceptive-beagle-348.convex.cloud";
    return new ConvexReactClient(url);
  }, []);

  return (
    <ConvexProvider client={convex}>
      <ThemeProvider>
        <I18nProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </I18nProvider>
      </ThemeProvider>
    </ConvexProvider>
  );
}
