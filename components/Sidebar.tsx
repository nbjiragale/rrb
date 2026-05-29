"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Layers,
  BookOpen,
  GraduationCap,
  PencilLine,
  MessageCircle,
  Upload,
  CalendarCheck,
  Timer,
  Share2,
} from "lucide-react";

const items = [
  { href: "/review", label: "Review", icon: GraduationCap },
  { href: "/practice", label: "Practice", icon: PencilLine },
  { href: "/mock", label: "Mock", icon: Timer },
  { href: "/planner", label: "Planner", icon: CalendarCheck },
  { href: "/tutor", label: "Tutor", icon: MessageCircle },
  { href: "/cards", label: "Cards", icon: Layers },
  { href: "/concepts", label: "Concepts", icon: BookOpen },
  { href: "/graph", label: "Graph", icon: Share2 },
  { href: "/ingest", label: "Ingest", icon: Upload },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <nav className="bg-subtle h-full w-56 shrink-0 p-3 hidden md:flex md:flex-col gap-1">
      <div className="px-3 py-3 text-h3 font-serif text-primary">RRB NTPC</div>
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={`relative flex items-center gap-3 rounded-md px-3 py-2 text-body transition-colors duration-150 ${
              active
                ? "bg-active text-primary font-medium"
                : "text-secondary hover:bg-hover hover:text-primary"
            }`}
          >
            {active && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-accent" />
            )}
            <Icon size={18} strokeWidth={1.5} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

// The daily-use core for the small-screen bottom bar (the full set lives in the
// desktop sidebar). Keeps the bar uncrowded (UIdesignspec §5).
const mobileItems = items.filter((i) =>
  ["/review", "/practice", "/mock", "/planner", "/tutor"].includes(i.href)
);

// Mobile bottom tab bar — the sidebar's small-screen form (UIdesignspec §5).
export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-10 flex border-t border-border bg-subtle">
      {mobileItems.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center gap-1 py-2 text-caption ${
              active ? "text-accent-strong" : "text-secondary"
            }`}
          >
            <Icon size={20} strokeWidth={1.5} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
