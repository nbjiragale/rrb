"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { groupForPath, isActiveHref } from "@/lib/nav";

// Section tab bar for clustered screens (Insights, Study aids, Content,
// Library). Rendered once in the layout; reads the route to pick the active
// group and tab. Returns nothing on top-level routes. Underline style per
// UIdesignspec ("Tab active: text-primary + 2px accent underline, not boxed").
export function SectionTabs() {
  const pathname = usePathname();
  const group = groupForPath(pathname);
  if (!group) return null;

  return (
    <div className="shrink-0 border-b border-border bg-canvas">
      <div className="flex gap-1 px-6 md:px-8" role="tablist" aria-label={group.label}>
        {group.tabs.map((t) => {
          const active = isActiveHref(pathname, t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`relative px-3 py-3 text-body transition-colors duration-150 ${
                active ? "text-primary font-medium" : "text-secondary hover:text-primary"
              }`}
            >
              {t.label}
              {active && <span className="absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-accent" />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
