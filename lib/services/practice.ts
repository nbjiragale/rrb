import { withTransaction } from "@/lib/db/client";
import { insertAttempt } from "@/lib/db/queries/attempts";
import { getMasteryForUpdate, upsertMastery } from "@/lib/db/queries/mastery";
import { bktUpdate, masteryLevel } from "@/lib/bkt";
import type { Confidence, ConceptMastery } from "@/lib/db/types";

const DEFAULT_P_KNOWN = 0.1;

// Write path (architecture §9, step 1): log the attempt and update the student
// model atomically. The raw attempt is immutable; concept_mastery is derived.
export async function recordPracticeAttempt(input: {
  questionId: number;
  conceptId: number;
  selectedOption: number | null;
  isCorrect: boolean;
  confidence: Confidence | null;
  timeMs: number | null;
}): Promise<void> {
  const { questionId, conceptId, selectedOption, isCorrect, confidence, timeMs } = input;
  const now = new Date();

  await withTransaction(async (tx) => {
    await insertAttempt(
      {
        question_id: questionId,
        concept_id: conceptId,
        selected_option: selectedOption,
        is_correct: isCorrect,
        confidence,
        time_taken_ms: timeMs,
        context: "practice",
      },
      tx
    );

    const prev = await getMasteryForUpdate(conceptId, tx);
    const next = applyAttempt(prev, conceptId, isCorrect, confidence, now);
    await upsertMastery(next, tx);
  });
}

// Pure: fold one attempt into a concept's mastery row (BKT + running stats).
function applyAttempt(
  prev: ConceptMastery | null,
  conceptId: number,
  isCorrect: boolean,
  confidence: Confidence | null,
  now: Date
): ConceptMastery {
  const attempts = (prev?.attempts ?? 0) + 1;
  const correct = (prev?.correct ?? 0) + (isCorrect ? 1 : 0);
  const wrong = (prev?.wrong ?? 0) + (isCorrect ? 0 : 1);
  const pKnown = bktUpdate(prev?.p_known ?? DEFAULT_P_KNOWN, isCorrect);

  return {
    concept_id: conceptId,
    attempts,
    correct,
    wrong,
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
