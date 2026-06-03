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
        <FocusProvider>
          <AppShell>{children}</AppShell>
        </FocusProvider>
      </body>
    </html>
  );
}
