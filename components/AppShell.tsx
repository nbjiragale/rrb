"use client";

import { usePathname } from "next/navigation";
import { Sidebar, MobileTabBar } from "@/components/Sidebar";
import { SectionTabs } from "@/components/SectionTabs";
import { CommandPalette } from "@/components/CommandPalette";
import { isFocusRoute } from "@/lib/nav";

// The app frame. On focus routes (Review) the rail, section tabs, and mobile bar
// drop away for single-task immersion; the command palette stays so ⌘K can still
// navigate out (UIredesignspec §5.1).
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isFocusRoute(pathname)) {
    return (
      <>
        <main className="h-dvh overflow-y-auto">{children}</main>
        <CommandPalette />
      </>
    );
  }

  return (
    <>
      <div className="flex h-dvh">
        <Sidebar />
        <main className="flex flex-1 flex-col overflow-hidden">
          <SectionTabs />
          <div className="flex-1 overflow-y-auto pb-20 md:pb-0">{children}</div>
        </main>
      </div>
      <MobileTabBar />
      <CommandPalette />
    </>
  );
}
