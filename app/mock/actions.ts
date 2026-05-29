"use server";

import { z } from "zod";
import { startMock, submitMock, type StartedMock, type MockAnalysis } from "@/lib/services/mock";

const startSchema = z.object({
  type: z.enum(["full_cbt1", "full_cbt2", "sectional"]),
  subject: z.enum(["math", "reasoning", "ga"]).optional(),
});

export async function startMockAction(input: {
  type: "full_cbt1" | "full_cbt2" | "sectional";
  subject?: "math" | "reasoning" | "ga";
}): Promise<StartedMock> {
  return startMock(startSchema.parse(input));
}

const submitSchema = z.object({
  sessionId: z.number().int().positive(),
  answers: z.array(
    z.object({
      questionId: z.number().int().positive(),
      selectedOption: z.number().int().min(0).max(3).nullable(),
    })
  ),
  pacing: z.array(
    z.object({ q: z.number().int(), cumulative_ms: z.number().int().nonnegative() })
  ),
});

export async function submitMockAction(input: {
  sessionId: number;
  answers: { questionId: number; selectedOption: number | null }[];
  pacing: { q: number; cumulative_ms: number }[];
}): Promise<MockAnalysis> {
  return submitMock(submitSchema.parse(input));
}
