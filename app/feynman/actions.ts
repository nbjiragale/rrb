"use server";

import { z } from "zod";
import { gradeFeynman, type FeynmanFeedback } from "@/lib/services/feynman";

const schema = z.object({
  conceptId: z.coerce.number().int().positive(),
  explanation: z.string().trim().min(20, "Write a few sentences explaining the concept."),
});

export interface FeynmanResult {
  ok: boolean;
  message?: string;
  feedback?: FeynmanFeedback;
}

// J1/G5 — grade a Feynman explanation; it's stored as recallable memory.
export async function gradeFeynmanAction(input: {
  conceptId: number;
  explanation: string;
}): Promise<FeynmanResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  try {
    const { feedback } = await gradeFeynman(parsed.data);
    return { ok: true, feedback };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Grading failed." };
  }
}
