"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { submitMockAction } from "@/app/mock/actions";
import { useFocusMode } from "@/components/FocusContext";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import type { StartedMock } from "@/lib/services/mock";
import type { MockAnalysis } from "@/lib/services/mock";

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

interface PacingEntry {
  q: number;
  cumulative_ms: number;
}

interface RunState {
  current: number;
  answers: (number | null)[];
  pacing: PacingEntry[];
}

// D1/D3 — distraction-free timed runner: mono timer (warning <5m, danger <1m),
// question palette, first-class skip, auto-submit at time-up. State persisted
// keyed by sessionId so reloads or tab switches resume the exam. Timer derives
// from `startedAt` (wall-clock) so background-tab throttling and reloads can't
// pause it.
export function MockRunner({
  started,
  startedAt,
  onDone,
  onQuit,
}: {
  started: StartedMock;
  startedAt: number;
  onDone: (a: MockAnalysis) => void;
  onQuit?: () => void;
}) {
  const { questions, timeLimitS } = started;

  // Drop the app chrome for the duration of the exam (UIredesignspec §10.4).
  useFocusMode(true);

  const [run, setRun] = useLocalStorage<RunState>(`mock:run:${started.sessionId}`, {
    current: 0,
    answers: questions.map(() => null),
    pacing: [],
  });
  // Defensive: a stored run for a different question count would crash the
  // palette. Normalise to the current question count if the lengths drifted.
  const answers =
    run.answers.length === questions.length
      ? run.answers
      : questions.map((_, i) => run.answers[i] ?? null);
  const current = Math.min(run.current, questions.length - 1);

  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Tick once a second so the timer derived from wall clock re-renders.
  const [, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const remaining = Math.max(0, timeLimitS - Math.floor((Date.now() - startedAt) / 1000));

  async function submit() {
    if (submitted) return;
    setSubmitted(true);
    setSubmitting(true);
    const payload = {
      sessionId: started.sessionId,
      answers: questions.map((q, i) => ({ questionId: q.id, selectedOption: answers[i] })),
      pacing: [...run.pacing].sort((a, b) => a.q - b.q),
    };
    const analysis = await submitMockAction(payload);
    onDone(analysis);
  }

  // Auto-submit at time-up.
  useEffect(() => {
    if (remaining <= 0 && !submitted) {
      void submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, submitted]);

  function choose(option: number) {
    setRun((prev) => {
      const nextAnswers = [...prev.answers];
      // tap again to clear (skip)
      nextAnswers[current] = nextAnswers[current] === option ? null : option;
      const cumulative_ms = Date.now() - startedAt;
      const otherPacing = prev.pacing.filter((p) => p.q !== current + 1);
      return {
        ...prev,
        answers: nextAnswers,
        pacing: [...otherPacing, { q: current + 1, cumulative_ms }],
      };
    });
  }

  function goTo(i: number) {
    setRun((prev) => ({ ...prev, current: i }));
  }

  const q = questions[current];
  const timerTone =
    remaining < 60 ? "text-danger" : remaining < 300 ? "text-warning" : "text-primary";

  // Exam keyboard: A–D select/clear, ←/→ navigate (UIredesignspec §12).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || submitted) return;
      const optIndex = { a: 0, b: 1, c: 2, d: 3 }[e.key.toLowerCase()];
      if (optIndex !== undefined && optIndex < q.options.length) {
        e.preventDefault();
        choose(optIndex);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goTo(Math.max(0, current - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goTo(Math.min(questions.length - 1, current + 1));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, q, questions.length, submitted]);

  return (
    <div className="mx-auto max-w-column px-6 py-6">
      {/* Sticky exam bar */}
      <div className="sticky top-0 z-10 mb-4 flex items-center justify-between border-b border-border bg-canvas py-3">
        <span className={`font-mono text-h2 ${timerTone}`}>{fmt(remaining)}</span>
        <div className="flex items-center gap-3">
          <span className="text-small text-muted">
            {answers.filter((a) => a !== null).length}/{questions.length} answered
          </span>
          {onQuit && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Quit this mock? Your in-progress answers will be discarded.")) {
                  onQuit();
                }
              }}
              className="text-small text-muted hover:text-danger underline transition-colors duration-150"
            >
              Quit
            </button>
          )}
        </div>
      </div>

      {/* Palette */}
      <div className="mb-5 flex flex-wrap gap-1.5">
        {questions.map((_, i) => {
          const answered = answers[i] !== null;
          const isCurrent = i === current;
          return (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`h-7 w-7 rounded-sm text-caption transition-colors duration-150 ${
                isCurrent
                  ? "border-2 border-accent bg-surface text-primary"
                  : answered
                    ? "bg-accent-subtle text-accent-strong"
                    : "bg-mastery-0 text-secondary"
              }`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <p className="mb-2 text-small text-muted">Question {current + 1}</p>
      <p className="text-body-lg whitespace-pre-wrap">{q.stem}</p>

      <div className="mt-5 grid gap-3">
        {q.options.map((opt, i) => (
          <button
            key={i}
            onClick={() => choose(i)}
            className={`flex w-full items-start gap-3 rounded-md border p-4 text-left text-body transition-colors duration-150 ${
              answers[current] === i
                ? "border-accent bg-accent-subtle"
                : "border-border bg-surface hover:bg-hover"
            }`}
          >
            <span className="mt-0.5 font-mono text-caption text-muted">
              {String.fromCharCode(65 + i)}
            </span>
            <span className="whitespace-pre-wrap">{opt}</span>
          </button>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <Button variant="ghost" disabled={current === 0} onClick={() => goTo(Math.max(0, current - 1))}>
          Previous
        </Button>
        {current < questions.length - 1 ? (
          <Button variant="secondary" onClick={() => goTo(current + 1)}>
            Next
          </Button>
        ) : !confirming ? (
          <Button onClick={() => setConfirming(true)}>Submit</Button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-small text-secondary">Submit now?</span>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? "Scoring…" : "Confirm"}
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={submitting}>
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
