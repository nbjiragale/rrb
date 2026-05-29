"use server";

import { z } from "zod";
import { getCard, applySchedule } from "@/lib/db/queries/cards";
import { logReview } from "@/lib/db/queries/reviews";
import { schedule } from "@/lib/fsrs";
import type { Rating } from "@/lib/db/types";

const ratingSchema = z.object({
  cardId: z.number().int().positive(),
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  responseMs: z.number().int().nonnegative().nullable(),
});

// B2 — rate recall: FSRS updates the card, an immutable review row is logged.
export async function rateCard(input: {
  cardId: number;
  rating: Rating;
  responseMs: number | null;
}): Promise<{ ok: true; nextDue: string }> {
  const { cardId, rating, responseMs } = ratingSchema.parse(input);

  const card = await getCard(cardId);
  if (!card) throw new Error(`Card ${cardId} not found`);

  const next = schedule(card, rating);

  await applySchedule(cardId, next);
  await logReview({
    card_id: cardId,
    rating,
    response_ms: responseMs,
    prev_stability: card.stability,
    new_stability: next.stability,
    new_due_at: next.due_at,
  });

  return { ok: true, nextDue: next.due_at.toISOString() };
}
