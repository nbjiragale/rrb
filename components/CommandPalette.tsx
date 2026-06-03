"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft } from "lucide-react";
import { PALETTE_ITEMS, type NavTab } from "@/lib/nav";

// Subsequence fuzzy match: every char of the query appears in order. Returns a
// score (lower = better: tighter, earlier matches rank first) or null for no match.
function fuzzyScore(query: string, text: string): number | null {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  let score = 0;
  let prev = -1;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += prev === -1 ? ti : ti - prev; // earlier + contiguous = lower score
      prev = ti;
      qi++;
    }
  }
  return qi === q.length ? score : null;
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => {
    const scored = PALETTE_ITEMS.map((item) => ({ item, score: fuzzyScore(query, item.label) }))
      .filter((r): r is { item: NavTab; score: number } => r.score !== null)
      .sort((a, b) => a.score - b.score);
    return scored.map((r) => r.item);
  }, [query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setIndex(0);
  }, []);

  // Global ⌘K / Ctrl+K toggle (UIredesignspec §4.2).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  const select = useCallback(
    (item: NavTab | undefined) => {
      if (!item) return;
      close();
      router.push(item.href);
    },
    [close, router]
  );

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      select(results[index]);
    }
  }

  // Keep the active row in view.
  useEffect(() => {
    const el = listRef.current?.children[index] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [index]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-[#262624]/30 p-4 pt-[12vh] backdrop-blur-[2px]"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-full max-w-[560px] overflow-hidden rounded-xl border border-border bg-surface shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border-subtle px-4">
          <Search size={18} strokeWidth={1.5} className="shrink-0 text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Go to…"
            aria-label="Search screens"
            className="w-full bg-transparent py-3.5 text-body text-primary outline-none placeholder:text-muted"
          />
        </div>

        {results.length === 0 ? (
          <p className="px-4 py-6 text-center text-small text-muted">No matches</p>
        ) : (
          <ul ref={listRef} className="max-h-80 overflow-y-auto p-1.5">
            {results.map((item, i) => {
              const active = i === index;
              return (
                <li key={item.href}>
                  <button
                    type="button"
                    onMouseMove={() => setIndex(i)}
                    onClick={() => select(item)}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-body transition-colors duration-150 ${
                      active ? "bg-active text-primary" : "text-secondary"
                    }`}
                  >
                    <span className="truncate">
                      <span className="text-caption uppercase tracking-[0.02em] text-muted">
                        Go to
                      </span>{" "}
                      <span className="text-primary">{item.label}</span>
                    </span>
                    {active && (
                      <CornerDownLeft size={14} strokeWidth={1.5} className="shrink-0 text-muted" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
