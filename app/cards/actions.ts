"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createCard } from "@/lib/db/queries/cards";

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
