// Single source of truth for navigation, shared by the icon rail (Sidebar), the
// in-screen SectionTabs, the mobile tab bar, and the command palette. See
// UIredesignspec.md §3–§4: daily-use verbs live on the rail; related browse
// screens cluster under one rail entry (tabs inside); authoring/config sinks to
// Settings at the rail foot.

export type Intent = "today" | "practice" | "plan" | "knowledge" | "tutor" | "settings";

export interface NavTab {
  href: string;
  label: string;
  /** lucide icon key, mapped to a component in the client nav components. */
  icon?: string;
}

export interface NavSingle extends NavTab {
  intent: Intent;
}

export interface NavGroup {
  key: string;
  label: string;
  icon?: string;
  intent: Intent;
  tabs: NavTab[];
}

// Frequent, single-screen destinations — no sub-tabs. Ordered by daily cadence.
export const NAV_SINGLES: NavSingle[] = [
  { href: "/", label: "Today", icon: "home", intent: "today" },
  { href: "/review", label: "Review", icon: "review", intent: "practice" },
  { href: "/practice", label: "Practice", icon: "practice", intent: "practice" },
  { href: "/mock", label: "Mocks", icon: "mock", intent: "practice" },
  { href: "/planner", label: "Planner", icon: "planner", intent: "plan" },
  { href: "/dashboard", label: "Dashboard", icon: "dashboard", intent: "plan" },
  { href: "/tutor", label: "Tutor", icon: "tutor", intent: "tutor" },
];

// Clustered browse/config screens — one rail entry, tabbed inside via SectionTabs.
export const NAV_GROUPS: NavGroup[] = [
  {
    key: "knowledge",
    label: "Knowledge",
    icon: "knowledge",
    intent: "knowledge",
    tabs: [
      { href: "/graph", label: "Graph" },
      { href: "/concepts", label: "Concepts" },
      { href: "/cards", label: "Cards" },
      { href: "/diagnosis", label: "Mistakes" },
      { href: "/current-affairs", label: "Current affairs" },
      { href: "/digest", label: "Digest" },
    ],
  },
  {
    key: "settings",
    label: "Settings",
    icon: "settings",
    intent: "settings",
    tabs: [
      { href: "/exam", label: "Exam" },
      { href: "/calibration", label: "Calibration" },
      { href: "/ingest", label: "Ingest" },
      { href: "/import/testbook", label: "Import" },
      { href: "/generate", label: "Generate" },
    ],
  },
];

// Study micro-modes launched from other screens (UIredesignspec §3) — not rail
// destinations, but kept reachable via the command palette and direct URL.
export const NAV_EXTRAS: NavTab[] = [
  { href: "/feynman", label: "Feynman" },
  { href: "/recall", label: "Recall" },
];

export interface RailItem {
  href: string;
  label: string;
  icon: string;
  intent: Intent;
  /** Set for group entries so the rail can mark it active on any of its tabs. */
  groupKey?: string;
}

// The ordered rail: daily-use singles, then one entry per clustered group. The
// group entry links to its first tab. Intent drives the expanded-drawer headers.
export const RAIL: RailItem[] = [
  ...NAV_SINGLES.map((s) => ({
    href: s.href,
    label: s.label,
    icon: s.icon!,
    intent: s.intent,
  })),
  ...NAV_GROUPS.map((g) => ({
    href: g.tabs[0].href,
    label: g.label,
    icon: g.icon!,
    intent: g.intent,
    groupKey: g.key,
  })),
];

// Every navigable destination, flattened — feeds the command palette.
export const PALETTE_ITEMS: NavTab[] = [
  ...NAV_SINGLES.map(({ href, label }) => ({ href, label })),
  ...NAV_GROUPS.flatMap((g) => g.tabs.map((t) => ({ href: t.href, label: t.label }))),
  ...NAV_EXTRAS,
];

// Focus routes hide the rail, section tabs, and mobile bar for distraction-free
// single-task immersion (UIredesignspec §5.1 / §10.2). The command palette stays
// mounted so ⌘K can still navigate out.
export const FOCUS_ROUTES = ["/review"];

export function isFocusRoute(pathname: string): boolean {
  return FOCUS_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"));
}

// A route belongs to a tab when it matches exactly or is a nested sub-route.
export function isActiveHref(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

// The group whose tabs contain the current route, or undefined for top-level
// (or ungrouped) routes — drives whether the in-screen SectionTabs row shows.
export function groupForPath(pathname: string): NavGroup | undefined {
  return NAV_GROUPS.find((g) => g.tabs.some((t) => isActiveHref(pathname, t.href)));
}
