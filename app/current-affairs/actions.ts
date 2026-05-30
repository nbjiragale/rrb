"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isLlmConfigured } from "@/lib/llm/router";
import { caExamProbability } from "@/lib/caRanking";
import { insertCaItem, getCaItem } from "@/lib/db/queries/currentAffairs";
import { generateCaCards } from "@/lib/services/currentAffairs";
import { generateGaQuestions } from "@/lib/services/generation";

export type CaState = { ok: boolean; message: string };

const ingestSchema = z.object({
  ca_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  source_url: z.string().trim().url().optional().or(z.literal("")).nullable(),
  category: z.string().trim().max(60).optional().nullable(),
  raw_text: z.string().trim().min(20, "Paste the source text (min 20 chars)."),
});

// H1 — ingest a current-affairs source. raw_text is retained for grounding.
export async function ingestCaAction(_prev: CaState, formData: FormData): Promise<CaState> {
  const parsed = ingestSchema.safeParse({
    ca_date: formData.get("ca_date"),
    source_url: formData.get("source_url") || null,
    category: formData.get("category") || null,
    raw_text: formData.get("raw_text"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const d = parsed.data;
  const item = await insertCaItem({
    ca_date: d.ca_date,
    source_url: d.source_url || null,
    category: d.category || null,
    raw_text: d.raw_text,
    exam_probability: caExamProbability(d.category),
  });
  revalidatePath("/current-affairs");
  return { ok: true, message: `Ingested item #${item.id}.` };
}

const genSchema = z.object({
  caId: z.coerce.number().int().positive(),
  conceptId: z.coerce.number().int().positive(),
  count: z.coerce.number().int().min(1).max(10).default(5),
});

// H2 — build grounded SRS cards from a CA item's raw_text.
export async function generateCaCardsAction(input: {
  caId: number;
  conceptId: number;
  count?: number;
}): Promise<CaState> {
  const d = genSchema.parse(input);
  if (!isLlmConfigured()) return { ok: false, message: "LLM not configured." };
  try {
    const r = await generateCaCards({ caId: d.caId, conceptId: d.conceptId, count: d.count });
    revalidatePath("/cards");
    revalidatePath("/current-affairs");
    return {
      ok: r.grounded > 0,
      message:
        r.grounded > 0
          ? `Added ${r.grounded} grounded card(s) to review.`
          : "No grounded cards could be built from this source.",
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Card generation failed." };
  }
}

// C4 — build grounded GA questions from a CA item's raw_text. gen_source = ca:<id>.
export async function generateCaQuestionsAction(input: {
  caId: number;
  conceptId: number;
  count?: number;
}): Promise<CaState> {
  const d = genSchema.parse(input);
  if (!isLlmConfigured()) return { ok: false, message: "LLM not configured." };
  try {
    const ca = await getCaItem(d.caId);
    if (!ca) return { ok: false, message: "Current-affairs item not found." };
    const r = await generateGaQuestions({
      conceptId: d.conceptId,
      sourceText: ca.raw_text,
      genSource: `ca:${ca.id}`,
      count: d.count,
    });
    revalidatePath("/practice");
    return {
      ok: r.verified > 0,
      message:
        r.verified > 0
          ? `Added ${r.verified} verified question(s) of ${r.generated} generated.`
          : "No questions passed the verify gate.",
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Question generation failed." };
  }
}
