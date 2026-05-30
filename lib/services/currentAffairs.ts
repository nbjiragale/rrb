import { z } from "zod";
import { complete, isLlmConfigured } from "@/lib/llm/router";
import { parseJson } from "@/lib/llm/json";
import {
  buildCaCardSystemPrompt,
  buildCaCardUserPrompt,
  buildCaSummarySystemPrompt,
  buildCaSummaryUserPrompt,
} from "@/lib/llm/prompts/generate";
import { verifyGroundedCards } from "@/lib/llm/verify";
import {
  getCaItem,
  markCaProcessed,
  setCaSummary,
  getUnsummarizedCaItems,
} from "@/lib/db/queries/currentAffairs";
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

// H3 — one-sentence grounded summary for the digest.
export async function summarizeCaItem(caId: number): Promise<string | null> {
  const ca = await getCaItem(caId);
  if (!ca?.raw_text?.trim()) return null;
  const summary = await complete({
    system: buildCaSummarySystemPrompt(),
    messages: [{ role: "user", content: buildCaSummaryUserPrompt(ca.raw_text) }],
    task: "bulk",
    maxTokens: 120,
  });
  await setCaSummary(caId, summary);
  return summary;
}

// Nightly: summarise recently-ingested items missing a digest summary (bounded).
export async function summarizePendingCa(limit = 10): Promise<{ summarized: number }> {
  if (!isLlmConfigured()) return { summarized: 0 };
  const items = await getUnsummarizedCaItems(limit);
  let summarized = 0;
  for (const item of items) {
    try {
      await summarizeCaItem(item.id);
      summarized++;
    } catch (err) {
      console.error(`summarizeCaItem(${item.id}) failed:`, err);
    }
  }
  return { summarized };
}
