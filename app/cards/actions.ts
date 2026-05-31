"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createCard } from "@/lib/db/queries/cards";
import { isLlmConfigured } from "@/lib/llm/router";
import {
  generateFactCards,
  generateGroundedCards,
  type CardGenReport,
} from "@/lib/services/cardGeneration";

const schema = z.object({
  concept_id: z.coerce.number().int().positive(),
  front: z.string().min(1),
  back: z.string().min(1),
  card_type: z.enum(["recall", "cloze", "mcq"]),
  source_ref: z.string().trim().optional().nullable(),
});

// A6 — create a review card by hand.
export async function addCard(formData: FormData) {
  const parsed = schema.parse({
    concept_id: formData.get("concept_id"),
    front: formData.get("front"),
    back: formData.get("back"),
    card_type: formData.get("card_type"),
    source_ref: formData.get("source_ref") || null,
  });
  await createCard(parsed);
  revalidatePath("/cards");
  revalidatePath("/review");
}

export type CardGenState = { ok: boolean; message: string };

function cardReport(r: CardGenReport): CardGenState {
  const failed = r.generated - r.created;
  return {
    ok: r.created > 0,
    message:
      r.created > 0
        ? `Added ${r.created} card(s) of ${r.generated} generated${failed > 0 ? ` (${failed} failed the check)` : ""}.`
        : `0 of ${r.generated} passed the check. Try again.`,
  };
}

const factCardSchema = z.object({
  conceptId: z.coerce.number().int().positive(),
  count: z.coerce.number().int().min(1).max(10),
});

// Generate verified math/reasoning recall cards for a concept.
export async function generateFactCardsAction(input: {
  conceptId: number;
  count: number;
}): Promise<CardGenState> {
  const d = factCardSchema.parse(input);
  if (!isLlmConfigured()) return { ok: false, message: "LLM not configured." };
  try {
    const r = await generateFactCards(d);
    revalidatePath("/cards");
    revalidatePath("/review");
    return cardReport(r);
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Generation failed." };
  }
}

const groundedCardSchema = z.object({
  conceptId: z.coerce.number().int().positive(),
  passage: z.string().trim().min(20, "Paste a source passage (min 20 chars)."),
  count: z.coerce.number().int().min(1).max(10),
});

// Generate verified GA recall cards grounded in a pasted passage.
export async function generateGroundedCardsAction(input: {
  conceptId: number;
  passage: string;
  count: number;
}): Promise<CardGenState> {
  const d = groundedCardSchema.parse(input);
  if (!isLlmConfigured()) return { ok: false, message: "LLM not configured." };
  try {
    const r = await generateGroundedCards({ conceptId: d.conceptId, sourceText: d.passage, count: d.count });
    revalidatePath("/cards");
    revalidatePath("/review");
    return cardReport(r);
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Generation failed." };
  }
}
