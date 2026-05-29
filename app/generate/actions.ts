"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isLlmConfigured } from "@/lib/llm/router";
import {
  generateMathQuestions,
  generateGaQuestions,
  type GenerationReport,
} from "@/lib/services/generation";

export type GenState = { ok: boolean; message: string };

function report(r: GenerationReport): GenState {
  return {
    ok: r.verified > 0,
    message:
      r.verified > 0
        ? `Added ${r.verified} verified of ${r.generated} generated${
            r.rejected.length ? ` (${r.rejected.length} failed the gate)` : ""
          }.`
        : `0 of ${r.generated} passed the verify gate. Try again.`,
  };
}

const mathSchema = z.object({
  conceptId: z.coerce.number().int().positive(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  count: z.coerce.number().int().min(1).max(10),
});

// C3 — fresh math/reasoning questions, verified by independent re-solve.
export async function generateMathAction(input: {
  conceptId: number;
  difficulty: string;
  count: number;
}): Promise<GenState> {
  const d = mathSchema.parse(input);
  if (!isLlmConfigured()) return { ok: false, message: "LLM not configured." };
  try {
    const r = await generateMathQuestions(d);
    revalidatePath("/practice");
    return report(r);
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Generation failed." };
  }
}

const gaSchema = z.object({
  conceptId: z.coerce.number().int().positive(),
  passage: z.string().trim().min(20, "Paste a source passage (min 20 chars)."),
  count: z.coerce.number().int().min(1).max(10),
});

// C4 — GA questions grounded in a pasted passage. gen_source = 'passage'.
export async function generateGaPassageAction(input: {
  conceptId: number;
  passage: string;
  count: number;
}): Promise<GenState> {
  const d = gaSchema.parse(input);
  if (!isLlmConfigured()) return { ok: false, message: "LLM not configured." };
  try {
    const r = await generateGaQuestions({
      conceptId: d.conceptId,
      sourceText: d.passage,
      genSource: "passage",
      count: d.count,
    });
    revalidatePath("/practice");
    return report(r);
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Generation failed." };
  }
}
