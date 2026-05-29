"use server";

import { z } from "zod";
import { getQuestionForGrading } from "@/lib/db/queries/questions";
import { recordAttempt } from "@/lib/services/attempt";

const schema = z.object({
  questionId: z.number().int().positive(),
  selectedOption: z.number().int().min(0).max(3),
  confidence: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  timeMs: z.number().int().nonnegative().nullable(),
});

export interface AttemptResult {
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

  await recordAttempt({
    questionId,
    conceptId: question.concept_id,
    selectedOption,
    isCorrect,
    confidence: confidence as 1 | 2 | 3 | 4 | 5,
    timeMs,
    context: "practice",
  });

  return {
    isCorrect,
    correctOption: question.correct_option,
    explanation: question.explanation,
  };
}
