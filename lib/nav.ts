// Single source of truth for navigation grouping, shared by the sidebar and the
// in-screen section tabs. Daily-use verbs stay top-level (SINGLES); related
// screens are collapsed into one sidebar entry each, with tabs inside (§5 — keep
// the shell uncrowded).

export interface NavTab {
  href: string;
  label: string;
}

export interface NavGroup {
  key: string;
  label: string;
  tabs: NavTab[];
}

// Frequent, single-screen destinations — no tabs. Digest is here (not under
// Content) because it's a daily read/revision activity, not an authoring tool.
export const NAV_SINGLES: NavTab[] = [
  { href: "/review", label: "Review" },
  { href: "/practice", label: "Practice" },
  { href: "/planner", label: "Planner" },
  { href: "/digest", label: "Digest" },
];

// Clustered screens — one sidebar entry, tabbed inside.
export const NAV_GROUPS: NavGroup[] = [
  {
    key: "mock",
    label: "Mock tests",
    tabs: [
      { href: "/mock", label: "Take a mock" },
      { href: "/exam", label: "Exam setup" },
    ],
  },
  {
    key: "study-aids",
    label: "Study aids",
    tabs: [
      { href: "/tutor", label: "Tutor" },
      { href: "/feynman", label: "Feynman" },
      { href: "/recall", label: "Recall" },
    ],
  },
  {
    key: "insights",
    label: "Insights",
    tabs: [
      { href: "/dashboard", label: "Overview" },
      { href: "/diagnosis", label: "Mistakes" },
      { href: "/calibration", label: "Calibration" },
    ],
  },
  {
    key: "content",
    label: "Content",
    tabs: [
      { href: "/ingest", label: "Ingest" },
      { href: "/generate", label: "Generate" },
      { href: "/current-affairs", label: "Current affairs" },
    ],
  },
  {
    key: "library",
    label: "Library",
    tabs: [
      { href: "/concepts", label: "Concepts" },
      { href: "/cards", label: "Cards" },
      { href: "/graph", label: "Graph" },
    ],
  },
];

// A route belongs to a tab when it matches exactly or is a nested sub-route.
export function isActiveHref(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

// The group whose tabs contain the current route, or undefined for top-level
// (or ungrouped) routes — drives whether the section tab bar shows.
export function groupForPath(pathname: string): NavGroup | undefined {
  return NAV_GROUPS.find((g) => g.tabs.some((t) => isActiveHref(pathname, t.href)));
}
