import type { ReactNode } from "react";

type Width = "shell" | "column" | "read";

const widthClass: Record<Width, string> = {
  shell: "max-w-shell",
  column: "max-w-column",
  read: "max-w-read",
};

interface Props {
  title: string;
  /** Scannable status chips between the title and the action (UIredesignspec §5.2). */
  chips?: ReactNode;
  /** The single primary action, right-aligned. */
  action?: ReactNode;
  /** Inner max-width — match the page body so header and content align. */
  width?: Width;
}

// The action-first page header (UIredesignspec §5.2): one row of
// title + status chips + one primary action. No subtitle paragraph — that is the
// documentation tell this redesign removes. Sticky so the action stays reachable.
export function PageHeader({ title, chips, action, width = "shell" }: Props) {
  return (
    <header className="sticky top-0 z-10 border-b border-border-subtle bg-canvas/90 backdrop-blur-sm">
      <div className={`mx-auto flex items-center gap-4 px-6 py-4 md:px-8 ${widthClass[width]}`}>
        <h1 className="text-h1 shrink-0">{title}</h1>
        {chips && <div className="flex min-w-0 flex-wrap items-center gap-2">{chips}</div>}
        {action && <div className="ml-auto shrink-0">{action}</div>}
      </div>
    </header>
  );
}
