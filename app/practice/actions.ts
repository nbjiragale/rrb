"use server";

import { z } from "zod";
import { getQuestionForGrading, flagQuestion } from "@/lib/db/queries/questions";
import { recordAttempt } from "@/lib/services/attempt";
import { tryDiagnoseAttempt } from "@/lib/services/diagnosis";

const schema = z.object({
  questionId: z.number().int().positive(),
  selectedOption: z.number().int().min(0).max(3),
  confidence: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  timeMs: z.number().int().nonnegative().nullable(),
});

export interface AttemptResult {
  attemptId: number;
  isCorrect: boolean;
  correctOption: number;
  explanation: string | null;
}

// C1 + G1 — grade server-side (never trust the client), log the attempt with
// confidence/time, and update mastery (BKT) atomically.
export async function submitPracticeAttempt(input: {
  questionId: number;
  selectedOption: number;
  confidence: number;
  timeMs: number | null;
}): Promise<AttemptResult> {
  const { questionId, selectedOption, confidence, timeMs } = schema.parse(input);

  const question = await getQuestionForGrading(questionId);
  if (!question) throw new Error(`Question ${questionId} not found or not verified`);

  const isCorrect = selectedOption === question.correct_option;

  const attemptId = await recordAttempt({
    questionId,
    conceptId: question.concept_id,
    selectedOption,
    isCorrect,
    confidence: confidence as 1 | 2 | 3 | 4 | 5,
    timeMs,
    context: "practice",
  });

  return {
    attemptId,
    isCorrect,
    correctOption: question.correct_option,
    explanation: question.explanation,
  };
}

// F1 — diagnose a wrong attempt out of the grading path (latency is acceptable;
// architecture §9 says async is fine). Returns a short label for the UI, or null.
export async function diagnoseAttemptAction(
  attemptId: number
): Promise<{ kind: string; description: string } | null> {
  const id = z.number().int().positive().parse(attemptId);
  const r = await tryDiagnoseAttempt(id);
  return r ? { kind: r.kind, description: r.description } : null;
}

// C6 — flag a bad question: one tap excludes it from serving and queues it for review.
export async function flagQuestionAction(input: {
  questionId: number;
  reason: string | null;
}): Promise<{ ok: boolean }> {
  const questionId = z.number().int().positive().parse(input.questionId);
  const reason = z.string().trim().max(500).nullable().parse(input.reason ?? null);
  const ok = await flagQuestion(questionId, reason);
  return { ok };
}
