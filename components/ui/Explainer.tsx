import type { ReactNode } from "react";
import { HelpCircle } from "lucide-react";

// Progressive-disclosure explainer for report screens: a quiet "How to read
// this" toggle that reveals a plain-language note without cluttering the default
// view (UIredesignspec §2.4). Native <details> — accessible, no JS.
export function Explainer({
  summary = "How to read this",
  children,
}: {
  summary?: string;
  children: ReactNode;
}) {
  return (
    <details className="group mt-3">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 text-small text-secondary transition-colors duration-150 hover:text-primary">
        <HelpCircle size={14} strokeWidth={1.5} className="shrink-0" />
        <span className="underline-offset-2 group-hover:underline">{summary}</span>
      </summary>
      <div className="mt-2 max-w-read text-small leading-relaxed text-secondary">{children}</div>
    </details>
  );
}
