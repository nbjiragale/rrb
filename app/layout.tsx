import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { FocusProvider } from "@/components/FocusContext";

export const metadata: Metadata = {
  title: "RRB NTPC — Personal Learning Platform",
  description: "Spaced-repetition review, practice, and study planning for RRB NTPC.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "RRB NTPC", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#FAF9F5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-canvas text-primary">
        {/* Self-hosted KaTeX styles (public/katex) — served as a static asset so
            math rendering never depends on bundler resolution of the npm package
            (and works offline for the PWA). React 19 hoists this into <head>. */}
        <link rel="stylesheet" href="/katex/katex.min.css" precedence="default" />
        <FocusProvider>
          <AppShell>{children}</AppShell>
        </FocusProvider>
      </body>
    </html>
  );
}
