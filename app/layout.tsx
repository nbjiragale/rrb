import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Sidebar, MobileTabBar } from "@/components/Sidebar";
import { SectionTabs } from "@/components/SectionTabs";

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
        <div className="flex h-dvh">
          <Sidebar />
          <main className="flex flex-1 flex-col overflow-hidden">
            <SectionTabs />
            <div className="flex-1 overflow-y-auto pb-20 md:pb-0">{children}</div>
          </main>
        </div>
        <MobileTabBar />
      </body>
    </html>
  );
}
