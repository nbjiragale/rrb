import { withTransaction, type Executor } from "@/lib/db/client";
import { insertAttempt } from "@/lib/db/queries/attempts";
import { getMasteryForUpdate, upsertMastery } from "@/lib/db/queries/mastery";
import { bktUpdate, masteryLevel } from "@/lib/bkt";
import type { AttemptContext, Confidence, ConceptMastery } from "@/lib/db/types";

const DEFAULT_P_KNOWN = 0.1;

export interface AttemptInput {
  questionId: number;
  conceptId: number;
  mockSessionId?: number | null;
  selectedOption: number | null;
  /** null = skipped (no mastery signal). */
  isCorrect: boolean | null;
  confidence: Confidence | null;
  timeMs: number | null;
  context: AttemptContext;
}

// Write path (architecture §9, step 1) for a single attempt inside a given
// transaction: log the immutable attempt, then fold it into the derived student
// model via BKT. Shared by practice (one attempt) and mocks (many, one txn).
export async function applyAttemptTx(tx: Executor, input: AttemptInput): Promise<void> {
  await insertAttempt(
    {
      question_id: input.questionId,
      concept_id: input.conceptId,
      mock_session_id: input.mockSessionId ?? null,
      selected_option: input.selectedOption,
      is_correct: input.isCorrect,
      confidence: input.confidence,
      time_taken_ms: input.timeMs,
      context: input.context,
    },
    tx
  );

  // Skips carry no knowledge signal — log only, leave mastery untouched.
  if (input.isCorrect === null) return;

  const prev = await getMasteryForUpdate(input.conceptId, tx);
  const next = foldAttempt(prev, input.conceptId, input.isCorrect, input.confidence, new Date());
  await upsertMastery(next, tx);
}

// Convenience for a single standalone attempt (practice).
export async function recordAttempt(input: AttemptInput): Promise<void> {
  await withTransaction((tx) => applyAttemptTx(tx, input));
}

// Pure: fold one graded attempt into a concept's mastery row.
function foldAttempt(
  prev: ConceptMastery | null,
  conceptId: number,
  isCorrect: boolean,
  confidence: Confidence | null,
  now: Date
): ConceptMastery {
  const pKnown = bktUpdate(prev?.p_known ?? DEFAULT_P_KNOWN, isCorrect);
  return {
    concept_id: conceptId,
    attempts: (prev?.attempts ?? 0) + 1,
    correct: (prev?.correct ?? 0) + (isCorrect ? 1 : 0),
    wrong: (prev?.wrong ?? 0) + (isCorrect ? 0 : 1),
    p_known: pKnown,
    avg_confidence: runningAvg(prev?.avg_confidence ?? null, prev?.attempts ?? 0, confidence),
    calibration_error: prev?.calibration_error ?? null, // fitted in v5
    mastery_level: masteryLevel(pKnown),
    last_seen_at: now.toISOString(),
    last_correct_at: isCorrect ? now.toISOString() : prev?.last_correct_at ?? null,
  };
}

function runningAvg(prevAvg: number | null, prevCount: number, value: number | null): number | null {
  if (value == null) return prevAvg;
  if (prevAvg == null || prevCount === 0) return value;
  return (prevAvg * prevCount + value) / (prevCount + 1);
}
