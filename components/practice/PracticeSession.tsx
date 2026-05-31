"use client";

import { useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import {
  submitPracticeAttempt,
  diagnoseAttemptAction,
  flagQuestionAction,
  type AttemptResult,
} from "@/app/practice/actions";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import type { PracticeQuestion } from "@/lib/db/types";

const CONFIDENCE = [1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }));

// Row styling reflects state after submit: correct → success, chosen-wrong → danger.
function optionClass(opts: {
  index: number;
  selected: number | null;
  result: AttemptResult | null;
}): string {
  const base = "w-full text-left rounded-md border p-4 text-body transition-colors duration-150";
  const { index, selected, result } = opts;

  if (!result) {
    return selected === index
      ? `${base} border-accent bg-accent-subtle`
      : `${base} border-border bg-surface hover:bg-hover`;
  }
  if (index === result.correctOption) return `${base} border-success bg-success-subtle`;
  if (index === selected) return `${base} border-danger bg-danger-subtle`;
  return `${base} border-border bg-surface opacity-70`;
}

export function PracticeSession({ questions }: { questions: PracticeQuestion[] }) {
  // Fingerprint the question set so swapping in a different list resets progress
  // — persisting index "5" from yesterday onto an unrelated list of 10 today
  // would put the learner on the wrong question.
  const fingerprint = questions.map((q) => q.id).join(",");
  const [index, setIndex] = useLocalStorage<number>(`practice:index:${fingerprint}`, 0);
  // The mid-question state (selected/confidence/result) is intentionally NOT
  // persisted: tab-switching mid-attempt should put you back at a clean choice
  // rather than restoring a half-committed answer in an ambiguous post-reveal state.
  const [selected, setSelected] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [pending, setPending] = useState(false);
  const [diagnosis, setDiagnosis] = useState<{ kind: string; description: string } | null>(null);
  const [flagged, setFlagged] = useState(false);
  const shownAt = useRef<number>(Date.now());

  const current = questions[index];

  if (!current) {
    return (
      <div className="mx-auto max-w-column px-6 py-16 text-center">
        <h1 className="text-h2 mb-2">Done</h1>
        <p className="text-secondary text-body-lg mb-6">
          You worked through every question here.
        </p>
        <Button variant="secondary" onClick={() => setIndex(0)}>
          Start over
        </Button>
      </div>
    );
  }

  async function submit() {
    if (selected === null || confidence === null || pending) return;
    setPending(true);
    try {
      const res = await submitPracticeAttempt({
        questionId: current.id,
        selectedOption: selected,
        confidence,
        timeMs: Date.now() - shownAt.current,
      });
      setResult(res);
      // F1 — diagnose wrong answers off the critical path; surface the label quietly.
      if (!res.isCorrect) {
        diagnoseAttemptAction(res.attemptId)
          .then(setDiagnosis)
          .catch(() => {});
      }
    } finally {
      setPending(false);
    }
  }

  async function flag() {
    if (flagged) return;
    setFlagged(true);
    await flagQuestionAction({ questionId: current.id, reason: null }).catch(() => {});
  }

  function next() {
    setIndex((i) => i + 1);
    setSelected(null);
    setConfidence(null);
    setResult(null);
    setDiagnosis(null);
    setFlagged(false);
    shownAt.current = Date.now();
  }

  return (
    <div className="mx-auto max-w-column px-6 py-8">
      <p className="mb-4 text-small text-muted">
        Question {index + 1} of {questions.length}
      </p>

      <Card className="p-6">
        <p className="text-body-lg whitespace-pre-wrap">{current.stem}</p>

        <div className="mt-5 grid gap-3">
          {current.options.map((opt, i) => (
            <button
              key={i}
              type="button"
              disabled={result !== null}
              onClick={() => setSelected(i)}
              className={optionClass({ index: i, selected, result })}
            >
              {opt}
            </button>
          ))}
        </div>
      </Card>

      {/* G1 — confidence captured BEFORE reveal, and required to submit. */}
      {!result ? (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-1.5 text-caption uppercase tracking-[0.02em] text-secondary">
              Confidence
            </p>
            <Segmented
              ariaLabel="Confidence 1 to 5"
              options={CONFIDENCE}
              value={confidence}
              onChange={setConfidence}
              disabled={pending}
            />
          </div>
          <Button onClick={submit} disabled={selected === null || confidence === null || pending}>
            Submit
          </Button>
        </div>
      ) : (
        <div className="mt-6">
          <div className="mb-4 flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${result.isCorrect ? "bg-success" : "bg-danger"}`} />
            <p className="text-body font-medium">
              {result.isCorrect ? "Correct" : "Incorrect"}
            </p>
          </div>
          {result.explanation && (
            <div className="mb-4 rounded-lg bg-subtle p-4">
              <p className="text-body whitespace-pre-wrap text-secondary">{result.explanation}</p>
            </div>
          )}
          {!result.isCorrect && diagnosis && (
            <p className="mb-4 text-small text-muted">
              <span className="text-secondary">Likely {diagnosis.kind.replace(/_/g, " ")}:</span>{" "}
              {diagnosis.description}
            </p>
          )}
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={next}>
              {index + 1 < questions.length ? "Next question" : "Finish"}
            </Button>
            <button
              type="button"
              onClick={flag}
              disabled={flagged}
              className="text-small text-muted hover:text-danger disabled:text-muted disabled:no-underline underline transition-colors duration-150"
            >
              {flagged ? "Flagged — thanks" : "Flag this question"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
