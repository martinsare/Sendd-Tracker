import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import Shell from "@/components/Shell";

export const metadata: Metadata = {
  title: "Senedd Tracker",
  description: "Track your Welsh Senedd representatives — speeches, votes, and participation.",
  metadataBase: new URL("https://senedd-tracker.replit.app"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <body>
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
