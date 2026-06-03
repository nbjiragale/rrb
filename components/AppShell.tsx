"use client";

import { usePathname } from "next/navigation";
import { Sidebar, MobileTabBar } from "@/components/Sidebar";
import { SectionTabs } from "@/components/SectionTabs";
import { CommandPalette } from "@/components/CommandPalette";
import { useFocusActive } from "@/components/FocusContext";
import { isFocusRoute } from "@/lib/nav";

// The app frame. In focus mode — a focus route (Review) or a surface that has
// requested it (the mock runner) — the rail, section tabs, and mobile bar drop
// away for single-task immersion; the palette stays so ⌘K can navigate out
// (UIredesignspec §5.1). The <main> and its {children} keep a fixed position in
// the tree regardless of focus, so toggling chrome never remounts the page.
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const focusActive = useFocusActive();
  const focus = isFocusRoute(pathname) || focusActive;

  return (
    <>
      <div className="flex h-dvh">
        {!focus && <Sidebar />}
        <main className="flex flex-1 flex-col overflow-hidden">
          {!focus && <SectionTabs />}
          <div className={`flex-1 overflow-y-auto ${focus ? "" : "pb-20 md:pb-0"}`}>{children}</div>
        </main>
      </div>
      {!focus && <MobileTabBar />}
      <CommandPalette />
    </>
  );
}
