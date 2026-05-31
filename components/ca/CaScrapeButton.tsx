"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { CaScrapeEvent } from "@/lib/services/caScraper";

// Same envelope the streaming route writes — plus a synthetic "fatal" line for
// transport-level failures the server can't catch in its own try/catch.
type StreamEvent = CaScrapeEvent | { type: "fatal"; message: string };

// Per-source state, built up incrementally as events arrive. We key on URL so
// re-runs naturally overwrite the previous render.
interface SourceState {
  url: string;
  index: number;
  total: number;
  chars: number | null;
  emitted: number | null;
  grounded: number | null;
  ingested: number;
  skipped: number;
  dropped: number;
  remaining: number | null;
  error: string | null;
  status: "scraping" | "splitting" | "ingesting" | "done" | "error" | "skipped";
}

interface RunState {
  running: boolean;
  startedAt: number | null;
  skipReason: string | null;
  fatal: string | null;
  sources: Map<string, SourceState>;
  done: boolean;
  finalIngested: number;
  finalSkipped: number;
  finalErrors: number;
}

const emptyRun: RunState = {
  running: false,
  startedAt: null,
  skipReason: null,
  fatal: null,
  sources: new Map(),
  done: false,
  finalIngested: 0,
  finalSkipped: 0,
  finalErrors: 0,
};

function applyEvent(prev: RunState, event: StreamEvent): RunState {
  const sources = new Map(prev.sources);
  const upsert = (url: string, patch: Partial<SourceState>) => {
    const existing = sources.get(url);
    if (!existing) return;
    sources.set(url, { ...existing, ...patch });
  };

  switch (event.type) {
    case "skip":
      return { ...prev, skipReason: event.reason };
    case "start":
      return { ...prev, sources: new Map() };
    case "source-start":
      sources.set(event.url, {
        url: event.url,
        index: event.index,
        total: event.total,
        chars: null,
        emitted: null,
        grounded: null,
        ingested: 0,
        skipped: 0,
        dropped: 0,
        remaining: null,
        error: null,
        status: "scraping",
      });
      return { ...prev, sources };
    case "scrape-done":
      upsert(event.url, { chars: event.chars, status: "splitting" });
      return { ...prev, sources };
    case "date-skip":
      upsert(event.url, { status: "skipped" });
      return { ...prev, sources };
    case "split-done":
      upsert(event.url, {
        emitted: event.emitted,
        grounded: event.grounded,
        remaining: event.grounded,
        status: "ingesting",
      });
      return { ...prev, sources };
    case "item":
      upsert(event.url, {
        ingested: event.ingested,
        skipped: event.skipped,
        remaining: event.remaining,
      });
      return { ...prev, sources };
    case "source-done":
      upsert(event.url, {
        ingested: event.ingested,
        skipped: event.skippedDuplicates,
        dropped: event.droppedUngrounded,
        remaining: 0,
        status: "done",
      });
      return { ...prev, sources };
    case "source-error":
      upsert(event.url, { error: event.message, status: "error" });
      return { ...prev, sources };
    case "done":
      return {
        ...prev,
        done: true,
        finalIngested: event.report.ingested,
        finalSkipped: event.report.skippedDuplicates,
        finalErrors: event.report.errors.length,
      };
    case "fatal":
      return { ...prev, fatal: event.message };
    default:
      // Forward-compatible: tolerate any new event types (e.g. server-side
      // primers like {type:"open"}) without breaking the state machine.
      return prev;
  }
}

// Manual trigger for the Firecrawl ingest configured via CA_SOURCE_URLS. Same
// pipeline as the nightly cron — useful for topping up mid-day. Streams live
// progress from /api/ca/scrape so each phase per source is visible.
export function CaScrapeButton() {
  const [run, setRun] = useState<RunState>(emptyRun);

  async function start() {
    setRun({ ...emptyRun, running: true, startedAt: Date.now() });
    try {
      const res = await fetch("/api/ca/scrape", { method: "POST" });
      if (!res.ok || !res.body) {
        setRun((prev) => ({
          ...prev,
          running: false,
          fatal: `Request failed (${res.status})`,
        }));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let event: StreamEvent;
          try {
            event = JSON.parse(trimmed) as StreamEvent;
          } catch {
            continue;
          }
          setRun((prev) => applyEvent(prev, event));
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setRun((prev) => ({ ...prev, fatal: message }));
    } finally {
      setRun((prev) => ({ ...prev, running: false }));
    }
  }

  const sources = Array.from(run.sources.values()).sort((a, b) => a.index - b.index);
  // Show the panel as soon as the user clicks, even before the first event
  // arrives — confirms the request started and surfaces the connecting state
  // instead of leaving the user staring at a frozen "Scraping…" button.
  const hasOutput =
    run.running || sources.length > 0 || run.skipReason || run.fatal || run.done;
  const awaitingFirstEvent =
    run.running && sources.length === 0 && !run.skipReason && !run.fatal;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" onClick={start} disabled={run.running}>
          {run.running ? "Scraping…" : "Scrape now"}
        </Button>
        <span className="text-small text-muted">
          Pulls from <code className="font-mono">CA_SOURCE_URLS</code> via Firecrawl.
        </span>
      </div>

      {hasOutput && (
        <div className="rounded-lg border border-default bg-surface p-4 shadow-xs">
          {awaitingFirstEvent && (
            <p className="text-small text-secondary">
              <span
                aria-hidden
                className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-accent align-middle"
              />
              Connecting to scraper…
            </p>
          )}

          {run.skipReason && (
            <p className="text-small text-danger">{run.skipReason}</p>
          )}

          {sources.length > 0 && (
            <ul className="divide-y divide-border-default">
              {sources.map((s) => (
                <SourceRow key={s.url} source={s} />
              ))}
            </ul>
          )}

          {run.done && !run.skipReason && (
            <p className="mt-3 text-small text-secondary">
              {run.finalIngested > 0
                ? `Done — ${run.finalIngested} new item(s) ingested${run.finalSkipped > 0 ? `, ${run.finalSkipped} duplicate(s) skipped` : ""}.`
                : `Done — no new items.${run.finalSkipped > 0 ? ` ${run.finalSkipped} duplicate(s) skipped.` : ""}`}
              {run.finalErrors > 0 && ` ${run.finalErrors} source error(s).`}
            </p>
          )}

          {run.fatal && (
            <p className="mt-3 text-small text-danger">Fatal: {run.fatal}</p>
          )}
        </div>
      )}
    </div>
  );
}

function Dot({ status }: { status: SourceState["status"] }) {
  // One quiet dot per phase. Pulsing accent while active, neutral check when
  // done, danger when errored. Respects prefers-reduced-motion via the global
  // CSS animation utility (Tailwind's animate-pulse honours it by default).
  if (status === "error") {
    return <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-danger" />;
  }
  if (status === "done") {
    return <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-success" />;
  }
  if (status === "skipped") {
    return <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-muted" />;
  }
  return (
    <span
      aria-hidden
      className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent"
    />
  );
}

function phaseLabel(s: SourceState): string {
  switch (s.status) {
    case "scraping":
      return "Fetching…";
    case "splitting":
      return `Splitting page (${s.chars?.toLocaleString() ?? "?"} chars)…`;
    case "ingesting":
      return s.remaining && s.remaining > 0
        ? `Ingesting items — ${s.remaining} remaining…`
        : "Ingesting items…";
    case "done":
      return `Ingested ${s.ingested} new, ${s.skipped} duplicate(s)` +
        (s.dropped > 0 ? `, ${s.dropped} dropped (ungrounded)` : "") + ".";
    case "skipped":
      return "Not published for this date — trying an earlier day…";
    case "error":
      return s.error ?? "Failed.";
  }
}

function SourceRow({ source }: { source: SourceState }) {
  return (
    <li className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <div className="mt-1.5 shrink-0">
        <Dot status={source.status} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-small font-mono text-secondary truncate">{source.url}</p>
        <p className={`text-small ${source.status === "error" ? "text-danger" : "text-primary"}`}>
          {phaseLabel(source)}
        </p>
        {source.status !== "scraping" && source.emitted !== null && source.grounded !== null && source.status !== "error" && (
          <p className="text-caption text-muted">
            LLM emitted {source.emitted} item(s); {source.grounded} grounded.
          </p>
        )}
      </div>
    </li>
  );
}
