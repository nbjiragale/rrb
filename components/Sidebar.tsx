"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Home,
  GraduationCap,
  PencilLine,
  Timer,
  CalendarCheck,
  LayoutDashboard,
  MessageCircle,
  Network,
  Settings,
  PanelLeftClose,
  PanelLeft,
  type LucideIcon,
} from "lucide-react";
import { RAIL, NAV_GROUPS, isActiveHref, type Intent, type RailItem } from "@/lib/nav";

const ICONS: Record<string, LucideIcon> = {
  home: Home,
  review: GraduationCap,
  practice: PencilLine,
  mock: Timer,
  planner: CalendarCheck,
  dashboard: LayoutDashboard,
  tutor: MessageCircle,
  knowledge: Network,
  settings: Settings,
};

const INTENT_LABEL: Record<Intent, string> = {
  today: "",
  practice: "Practice",
  plan: "Plan",
  knowledge: "Knowledge",
  tutor: "Tutor",
  settings: "Settings",
};

function railActive(pathname: string, item: RailItem): boolean {
  if (item.groupKey) {
    const group = NAV_GROUPS.find((g) => g.key === item.groupKey);
    return group?.tabs.some((t) => isActiveHref(pathname, t.href)) ?? false;
  }
  return isActiveHref(pathname, item.href);
}

const EXPANDED_KEY = "rrb.rail.expanded";

export function Sidebar() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);

  // Persist the expand/collapse preference (UIredesignspec §4.1).
  useEffect(() => {
    setExpanded(localStorage.getItem(EXPANDED_KEY) === "1");
  }, []);
  const toggle = () => {
    setExpanded((prev) => {
      const next = !prev;
      localStorage.setItem(EXPANDED_KEY, next ? "1" : "0");
      return next;
    });
  };

  return (
    <nav
      aria-label="Primary"
      className={`hidden h-full shrink-0 flex-col border-r border-border bg-subtle py-3 md:flex ${
        expanded ? "w-56" : "w-16"
      }`}
    >
      <Link
        href="/"
        className={`mb-2 flex items-center gap-2 px-3 py-2 ${expanded ? "" : "justify-center"}`}
        aria-label="RRB NTPC — Today"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent text-on-accent text-caption font-medium">
          R
        </span>
        {expanded && <span className="text-body font-medium text-primary">RRB NTPC</span>}
      </Link>

      <div className="flex-1 overflow-y-auto">
        {RAIL.map((item, i) => {
          const Icon = ICONS[item.icon] ?? Home;
          const active = railActive(pathname, item);
          const prev = RAIL[i - 1];
          const showHeader = expanded && item.intent !== "today" && item.intent !== prev?.intent;
          return (
            <div key={item.href}>
              {showHeader && (
                <div className="px-3 pb-1 pt-3 text-caption uppercase tracking-[0.02em] text-muted">
                  {INTENT_LABEL[item.intent]}
                </div>
              )}
              {!expanded && i > 0 && item.intent !== prev?.intent && (
                <div className="mx-3 my-1.5 border-t border-border-subtle" />
              )}
              <Link
                href={item.href}
                title={expanded ? undefined : item.label}
                aria-current={active ? "page" : undefined}
                className={`relative mx-2 my-0.5 flex items-center gap-3 rounded-md px-2.5 py-2 text-body transition-colors duration-150 ${
                  expanded ? "" : "justify-center"
                } ${
                  active
                    ? "bg-active text-primary font-medium"
                    : "text-secondary hover:bg-hover hover:text-primary"
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-accent" />
                )}
                <Icon size={18} strokeWidth={1.5} className="shrink-0" />
                {expanded && <span className="truncate">{item.label}</span>}
              </Link>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={toggle}
        aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
        className={`mx-2 mt-1 flex items-center gap-3 rounded-md px-2.5 py-2 text-secondary transition-colors duration-150 hover:bg-hover hover:text-primary ${
          expanded ? "" : "justify-center"
        }`}
      >
        {expanded ? (
          <PanelLeftClose size={18} strokeWidth={1.5} />
        ) : (
          <PanelLeft size={18} strokeWidth={1.5} />
        )}
        {expanded && <span className="text-small">Collapse</span>}
      </button>
    </nav>
  );
}

// The daily-use core for the small-screen bottom bar (UIredesignspec §4.3).
// Leads with Today; the full set lives in the desktop rail and command palette.
const mobileItems: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/", label: "Today", Icon: Home },
  { href: "/review", label: "Review", Icon: GraduationCap },
  { href: "/practice", label: "Practice", Icon: PencilLine },
  { href: "/mock", label: "Mocks", Icon: Timer },
  { href: "/tutor", label: "Tutor", Icon: MessageCircle },
];

export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-10 flex border-t border-border bg-subtle md:hidden"
    >
      {mobileItems.map(({ href, label, Icon }) => {
        const active = isActiveHref(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-1 py-2 text-caption ${
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
