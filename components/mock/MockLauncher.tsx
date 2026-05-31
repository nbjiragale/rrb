"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { startMockAction } from "@/app/mock/actions";
import { MockRunner } from "@/components/mock/MockRunner";
import { MockResult } from "@/components/mock/MockResult";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import type { StartedMock, MockAnalysis } from "@/lib/services/mock";
import type { Subject } from "@/lib/db/types";

// `startedAt` (wall-clock ms) is the source of truth for the remaining timer
// so reloads/tab-switches can't pause or skew it. Persisted alongside the
// session so an in-progress mock resumes correctly after a refresh.
type Phase =
  | { name: "choose" }
  | { name: "running"; started: StartedMock; startedAt: number }
  | { name: "done"; analysis: MockAnalysis };

const SECTIONS: { subject: Subject; label: string }[] = [
  { subject: "math", label: "Mathematics" },
  { subject: "reasoning", label: "Reasoning" },
  { subject: "ga", label: "General Awareness" },
];

export function MockLauncher() {
  const [phase, setPhase] = useLocalStorage<Phase>("mock:phase", { name: "choose" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function start(input: { type: "full_cbt1" | "sectional"; subject?: Subject }) {
    setError(null);
    setLoading(true);
    try {
      const started = await startMockAction(input);
      setPhase({ name: "running", started, startedAt: Date.now() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the mock.");
    } finally {
      setLoading(false);
    }
  }

  function quitToChoose() {
    if (phase.name === "running") {
      // Clear per-session runner state too.
      try {
        window.localStorage.removeItem(`mock:run:${phase.started.sessionId}`);
      } catch {
        // ignore
      }
    }
    setPhase({ name: "choose" });
  }

  if (phase.name === "running") {
    return (
      <MockRunner
        started={phase.started}
        startedAt={phase.startedAt}
        onDone={(analysis) => {
          try {
            window.localStorage.removeItem(`mock:run:${phase.started.sessionId}`);
          } catch {
            // ignore
          }
          setPhase({ name: "done", analysis });
        }}
        onQuit={quitToChoose}
      />
    );
  }

  if (phase.name === "done") {
    return <MockResult analysis={phase.analysis} onRestart={() => setPhase({ name: "choose" })} />;
  }

  return (
    <div className="mx-auto max-w-column px-6 py-8 md:px-8">
      <h1 className="text-h1 mb-2">Mock tests</h1>
      <p className="text-secondary text-body mb-6">
        Exam conditions: a running timer, first-class skipping, real negative marking.
      </p>

      <Card className="p-6 mb-6">
        <h2 className="text-h3 mb-1">Full mock</h2>
        <p className="text-small text-muted mb-4">All sections per your exam config.</p>
        <Button disabled={loading} onClick={() => start({ type: "full_cbt1" })}>
          {loading ? "Preparing…" : "Start full mock"}
        </Button>
      </Card>

      <Card className="p-6">
        <h2 className="text-h3 mb-1">Sectional</h2>
        <p className="text-small text-muted mb-4">Train one section intensively.</p>
        <div className="flex flex-wrap gap-3">
          {SECTIONS.map((s) => (
            <Button
              key={s.subject}
              variant="secondary"
              disabled={loading}
              onClick={() => start({ type: "sectional", subject: s.subject })}
            >
              {s.label}
            </Button>
          ))}
        </div>
      </Card>

      {error && <p className="mt-4 text-small text-danger">{error}</p>}
    </div>
  );
}
