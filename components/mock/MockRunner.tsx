"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { submitMockAction } from "@/app/mock/actions";
import type { StartedMock } from "@/lib/services/mock";
import type { MockAnalysis } from "@/lib/services/mock";

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

// D1/D3 — distraction-free timed runner: mono timer (warning <5m, danger <1m),
// question palette, first-class skip, auto-submit at time-up.
export function MockRunner({
  started,
  onDone,
}: {
  started: StartedMock;
  onDone: (a: MockAnalysis) => void;
}) {
  const { questions, timeLimitS } = started;
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [remaining, setRemaining] = useState(timeLimitS);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const startRef = useRef(Date.now());
  const pacing = useRef<Map<number, number>>(new Map());
  const submittedRef = useRef(false);

  async function submit() {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    const payload = {
      sessionId: started.sessionId,
      answers: questions.map((q, i) => ({ questionId: q.id, selectedOption: answers[i] })),
      pacing: [...pacing.current.entries()]
        .map(([q, cumulative_ms]) => ({ q, cumulative_ms }))
        .sort((a, b) => a.q - b.q),
    };
    const analysis = await submitMockAction(payload);
    onDone(analysis);
  }

  // Countdown; auto-submit at zero.
  useEffect(() => {
    if (remaining <= 0) {
      void submit();
      return;
    }
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  function choose(option: number) {
    setAnswers((prev) => {
      const next = [...prev];
      next[current] = next[current] === option ? null : option; // tap again to clear (skip)
      return next;
    });
    pacing.current.set(current + 1, Date.now() - startRef.current);
  }

  const q = questions[current];
  const timerTone =
    remaining < 60 ? "text-danger" : remaining < 300 ? "text-warning" : "text-primary";

  return (
    <div className="mx-auto max-w-column px-6 py-6">
      {/* Sticky exam bar */}
      <div className="sticky top-0 z-10 mb-4 flex items-center justify-between border-b border-border bg-canvas py-3">
        <span className={`font-mono text-h2 ${timerTone}`}>{fmt(Math.max(0, remaining))}</span>
        <span className="text-small text-muted">
          {answers.filter((a) => a !== null).length}/{questions.length} answered
        </span>
      </div>

      {/* Palette */}
      <div className="mb-5 flex flex-wrap gap-1.5">
        {questions.map((_, i) => {
          const answered = answers[i] !== null;
          const isCurrent = i === current;
          return (
            <button
              key={i}
              onClick={() => setCurrent(i)}
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
            className={`w-full rounded-md border p-4 text-left text-body transition-colors duration-150 ${
              answers[current] === i
                ? "border-accent bg-accent-subtle"
                : "border-border bg-surface hover:bg-hover"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <Button
          variant="ghost"
          disabled={current === 0}
          onClick={() => setCurrent((c) => Math.max(0, c - 1))}
        >
          Previous
        </Button>
        {current < questions.length - 1 ? (
          <Button variant="secondary" onClick={() => setCurrent((c) => c + 1)}>
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
