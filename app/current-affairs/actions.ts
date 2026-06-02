"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isLlmConfigured } from "@/lib/llm/router";
import { caExamProbability } from "@/lib/caRanking";
import { insertCaItem } from "@/lib/db/queries/currentAffairs";
import { listConcepts } from "@/lib/db/queries/concepts";
import { generateCaDayCards } from "@/lib/services/currentAffairs";
import { generateCaDayGaQuestions } from "@/lib/services/generation";

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

const dayGenSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  count: z.coerce.number().int().min(1).max(20).default(8),
});

async function loadGaConcepts() {
  const all = await listConcepts();
  return all.filter((c) => c.subject === "ga");
}

function unmappedNote(unmapped: number): string {
  return unmapped > 0
    ? ` ${unmapped} skipped — the model tagged them with concepts you haven't created yet.`
    : "";
}

// H2 — build grounded SRS cards from ALL of a day's current-affairs items in one
// pass: the model dedupes and prioritises across them, while each card stays
// grounded in a single source item (ca:<id>).
export async function generateCaDayCardsAction(input: {
  date: string;
  count?: number;
}): Promise<CaState> {
  const d = dayGenSchema.parse(input);
  if (!isLlmConfigured()) return { ok: false, message: "LLM not configured." };
  try {
    const gaConcepts = await loadGaConcepts();
    const r = await generateCaDayCards({ date: d.date, gaConcepts, count: d.count });
    revalidatePath("/cards");
    revalidatePath("/current-affairs");
    return {
      ok: r.grounded > 0,
      message:
        r.grounded > 0
          ? `Added ${r.grounded} grounded card(s) to review.${unmappedNote(r.unmapped)}`
          : `No grounded cards could be built from this day's sources.${unmappedNote(r.unmapped)}`,
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Card generation failed." };
  }
}

// C4 — build grounded GA questions from ALL of a day's current-affairs items in
// one pass, deduped and prioritised across them; each question stays grounded in
// a single source item. gen_source = ca:<id>.
export async function generateCaDayQuestionsAction(input: {
  date: string;
  count?: number;
}): Promise<CaState> {
  const d = dayGenSchema.parse(input);
  if (!isLlmConfigured()) return { ok: false, message: "LLM not configured." };
  try {
    const gaConcepts = await loadGaConcepts();
    const r = await generateCaDayGaQuestions({ date: d.date, gaConcepts, count: d.count });
    revalidatePath("/practice");
    return {
      ok: r.verified > 0,
      message:
        r.verified > 0
          ? `Added ${r.verified} verified question(s) of ${r.generated} generated.${unmappedNote(r.unmapped)}`
          : `No questions passed the verify gate.${unmappedNote(r.unmapped)}`,
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Question generation failed." };
  }
}
