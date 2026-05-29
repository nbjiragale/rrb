import { z } from "zod";
import { complete } from "@/lib/llm/router";
import { parseJson } from "@/lib/llm/json";
import { buildCaCardSystemPrompt, buildCaCardUserPrompt } from "@/lib/llm/prompts/generate";
import { verifyGroundedCards } from "@/lib/llm/verify";
import { getCaItem, markCaProcessed } from "@/lib/db/queries/currentAffairs";
import { createCard } from "@/lib/db/queries/cards";

const cardsSchema = z.array(z.object({ front: z.string().min(1), back: z.string().min(1) }));

export interface CaCardReport {
  generated: number;
  grounded: number;
  cardIds: number[];
}

// H2 — build SRS cards from a current-affairs item, grounded ONLY in its stored
// raw_text (Hard Rule §2.1). Cards enter the review loop as new (state='new')
// and are tagged to the supplied concept; source_ref records the CA provenance.
export async function generateCaCards(input: {
  caId: number;
  conceptId: number;
  count: number;
}): Promise<CaCardReport> {
  const ca = await getCaItem(input.caId);
  if (!ca) throw new Error(`Current-affairs item ${input.caId} not found`);
  if (!ca.raw_text?.trim()) throw new Error("Current-affairs item has no source text to ground in.");

  const raw = await complete({
    system: buildCaCardSystemPrompt(),
    messages: [
      { role: "user", content: buildCaCardUserPrompt({ sourceText: ca.raw_text, count: input.count }) },
    ],
    task: "generate",
    maxTokens: 1200,
  });

  const candidates = parseJson(raw, cardsSchema);
  const grounded = await verifyGroundedCards(candidates, ca.raw_text);

  const cardIds: number[] = [];
  for (const c of grounded) {
    const card = await createCard({
      concept_id: input.conceptId,
      front: c.front,
      back: c.back,
      card_type: "recall",
      source_ref: `ca:${ca.id}`,
    });
    cardIds.push(card.id);
  }

  await markCaProcessed(ca.id);
  return { generated: candidates.length, grounded: grounded.length, cardIds };
}
