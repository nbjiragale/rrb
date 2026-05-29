"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { isLlmConfigured } from "@/lib/llm/router";
import { generateAdversarial } from "@/lib/services/generation";

export interface AdversarialState {
  ok: boolean;
  message: string;
}

// C5 — generate an adversarial drill from a representative wrong attempt for a
// recurring misconception. The new item is verified through the gate before it
// becomes practiceable.
export async function generateAdversarialAction(attemptId: number): Promise<AdversarialState> {
  const id = z.number().int().positive().parse(attemptId);
  if (!isLlmConfigured()) {
    return { ok: false, message: "LLM not configured — set LLM_BASE_URL / LLM_API_KEY." };
  }

  try {
    const report = await generateAdversarial(id);
    revalidatePath("/practice");
    if (report.verified === 0) {
      return { ok: false, message: "Generated a variant but it failed the verify gate. Try again." };
    }
    return { ok: true, message: `Added ${report.verified} adversarial drill — find it in Practice.` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Generation failed." };
  }
}
