import Link from "next/link";
import type { ReactNode } from "react";

interface Props {
  /** Primary line (body / h3). */
  title: ReactNode;
  /** One-line secondary (small text-muted). */
  subtitle?: ReactNode;
  /** Leading slot — a mastery dot, index, or icon. */
  leading?: ReactNode;
  /** Trailing slot — status chips and/or a row menu. */
  trailing?: ReactNode;
  /** Renders the whole row as a link to a detail view. */
  href?: string;
}

// The atom of every Workbench list (UIredesignspec §9.3): a hairline-separated
// row, never a stacked card. ~56px, leading + (title/subtitle) + trailing.
export function ListRow({ title, subtitle, leading, trailing, href }: Props) {
  const inner = (
    <>
      {leading && <div className="flex shrink-0 items-center">{leading}</div>}
      <div className="min-w-0 flex-1">
        <div className="truncate text-body text-primary">{title}</div>
        {subtitle && <div className="mt-0.5 truncate text-small text-muted">{subtitle}</div>}
      </div>
      {trailing && <div className="flex shrink-0 items-center gap-2">{trailing}</div>}
    </>
  );

  const className =
    "flex min-h-14 items-center gap-3 border-b border-border-subtle px-4 py-2.5 transition-colors duration-150";

  if (href) {
    return (
      <Link href={href} className={`${className} hover:bg-hover`}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}
