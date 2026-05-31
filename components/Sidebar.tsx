"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GraduationCap,
  PencilLine,
  Timer,
  CalendarCheck,
  ScrollText,
  MessageCircle,
  LayoutDashboard,
  Upload,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import { NAV_SINGLES, NAV_GROUPS, isActiveHref } from "@/lib/nav";

const SINGLE_ICONS: Record<string, LucideIcon> = {
  "/review": GraduationCap,
  "/practice": PencilLine,
  "/planner": CalendarCheck,
  "/digest": ScrollText,
};

// Icon per group (keyed to lib/nav NAV_GROUPS).
const GROUP_ICONS: Record<string, LucideIcon> = {
  mock: Timer,
  "study-aids": MessageCircle,
  insights: LayoutDashboard,
  content: Upload,
  library: BookOpen,
};

// One flat list of {href, label, icon, isActive} for the desktop sidebar:
// daily-use singles first, then one entry per clustered group (links to its
// first tab, highlights when any of its tabs is active).
function buildNavItems(pathname: string) {
  const singles = NAV_SINGLES.map((s) => ({
    href: s.href,
    label: s.label,
    Icon: SINGLE_ICONS[s.href],
    active: isActiveHref(pathname, s.href),
  }));
  const groups = NAV_GROUPS.map((g) => ({
    href: g.tabs[0].href,
    label: g.label,
    Icon: GROUP_ICONS[g.key],
    active: g.tabs.some((t) => isActiveHref(pathname, t.href)),
  }));
  return [...singles, ...groups];
}

export function Sidebar() {
  const pathname = usePathname();
  const items = buildNavItems(pathname);
  return (
    <nav className="bg-subtle h-full w-56 shrink-0 p-3 hidden md:flex md:flex-col gap-1">
      <div className="px-3 py-3 text-h3 font-serif text-primary">RRB NTPC</div>
      {items.map(({ href, label, Icon, active }) => (
        <Link
          key={label}
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
          {Icon && <Icon size={18} strokeWidth={1.5} />}
          {label}
        </Link>
      ))}
    </nav>
  );
}

// The daily-use core for the small-screen bottom bar (the full set lives in the
// desktop sidebar). Keeps the bar uncrowded (UIdesignspec §5). Tutor stays one
// tap away even though it lives under the Study aids group on desktop.
const mobileItems: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/review", label: "Review", Icon: GraduationCap },
  { href: "/practice", label: "Practice", Icon: PencilLine },
  { href: "/mock", label: "Mock", Icon: Timer },
  { href: "/planner", label: "Planner", Icon: CalendarCheck },
  { href: "/tutor", label: "Tutor", Icon: MessageCircle },
];

// Mobile bottom tab bar — the sidebar's small-screen form (UIdesignspec §5).
export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-10 flex border-t border-border bg-subtle">
      {mobileItems.map(({ href, label, Icon }) => {
        const active = isActiveHref(pathname, href);
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
