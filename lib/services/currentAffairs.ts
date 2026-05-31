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
  getUnprocessedCaItems,
} from "@/lib/db/queries/currentAffairs";
import { createCard } from "@/lib/db/queries/cards";
import { listConcepts } from "@/lib/db/queries/concepts";
import type { Concept } from "@/lib/db/types";

// Per-night caps for auto-generation (Hard Rule §4 cost discipline). Env-tunable;
// 0 disables the step entirely.
const CA_AUTOGEN_MAX_ITEMS = Number(process.env.CA_AUTOGEN_MAX_ITEMS ?? 5);
const CA_AUTOGEN_CARDS_PER_ITEM = Number(process.env.CA_AUTOGEN_CARDS_PER_ITEM ?? 3);

const cardsSchema = z.array(
  z.object({
    front: z.string().min(1),
    back: z.string().min(1),
    concept: z.string().min(1).optional().nullable(),
  })
);

export interface CaCardReport {
  generated: number;
  grounded: number;
  unmapped: number; // cards the LLM tagged with a concept name we don't have
  cardIds: number[];
}

// Resolve an LLM-emitted concept name to one of our GA concept ids using a
// case-insensitive exact match (lenient — minor capitalisation drift shouldn't
// drop the card). Returns null if no match; caller decides whether to skip.
function resolveConceptId(name: string | null | undefined, gaConcepts: Concept[]): number | null {
  if (!name) return null;
  const key = name.trim().toLowerCase();
  return gaConcepts.find((c) => c.name.trim().toLowerCase() === key)?.id ?? null;
}

// H2 — build SRS cards from a current-affairs item, grounded ONLY in its stored
// raw_text (Hard Rule §2.1). One news item often spans multiple GA topics, so
// the LLM tags each card with its best-fit GA concept from the supplied list.
// Cards whose concept tag doesn't map to any of our concepts are skipped (we
// never invent concepts to avoid silent miscategorisation).
export async function generateCaCards(input: {
  caId: number;
  gaConcepts: Concept[];
  count: number;
}): Promise<CaCardReport> {
  const ca = await getCaItem(input.caId);
  if (!ca) throw new Error(`Current-affairs item ${input.caId} not found`);
  if (!ca.raw_text?.trim()) throw new Error("Current-affairs item has no source text to ground in.");
  if (input.gaConcepts.length === 0) {
    throw new Error("No GA concepts available — add at least one GA concept first.");
  }

  const raw = await complete({
    system: buildCaCardSystemPrompt(),
    messages: [
      {
        role: "user",
        content: buildCaCardUserPrompt({
          sourceText: ca.raw_text,
          count: input.count,
          gaConcepts: input.gaConcepts.map((c) => c.name),
        }),
      },
    ],
    task: "generate",
    maxTokens: 1200,
  });

  const candidates = parseJson(raw, cardsSchema);
  const grounded = await verifyGroundedCards(candidates, ca.raw_text);
  // Verifier strips by front/back text; re-pair each grounded card with its
  // original concept tag via lookup so we don't lose the routing.
  const conceptByPair = new Map(
    candidates.map((c) => [`${c.front}|${c.back}`, c.concept ?? null])
  );

  const cardIds: number[] = [];
  let unmapped = 0;
  for (const c of grounded) {
    const conceptName = conceptByPair.get(`${c.front}|${c.back}`);
    const conceptId = resolveConceptId(conceptName, input.gaConcepts);
    if (conceptId === null) {
      unmapped++;
      continue;
    }
    const card = await createCard({
      concept_id: conceptId,
      front: c.front,
      back: c.back,
      card_type: "recall",
      source_ref: `ca:${ca.id}`,
    });
    cardIds.push(card.id);
  }

  await markCaProcessed(ca.id);
  return {
    generated: candidates.length,
    grounded: cardIds.length,
    unmapped,
    cardIds,
  };
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

// Nightly: turn freshly-scraped CA items into grounded SRS cards so current
// affairs flow into Review automatically (closes the scrape→study loop) instead
// of waiting for a manual click. Bounded per night for cost; each item is still
// grounded strictly in its raw_text and passes the verify gate (Hard Rule §2.1).
// Skips silently when the LLM isn't configured, there are no GA concepts, or the
// caps are zeroed. generateCaCards stamps processed_at, so items aren't redone.
export async function autoGenerateCaCards(opts?: {
  maxItems?: number;
  cardsPerItem?: number;
}): Promise<{ items: number; cards: number }> {
  const maxItems = opts?.maxItems ?? CA_AUTOGEN_MAX_ITEMS;
  const cardsPerItem = opts?.cardsPerItem ?? CA_AUTOGEN_CARDS_PER_ITEM;
  if (!isLlmConfigured() || maxItems <= 0 || cardsPerItem <= 0) return { items: 0, cards: 0 };

  const gaConcepts = (await listConcepts()).filter((c) => c.subject === "ga");
  if (gaConcepts.length === 0) return { items: 0, cards: 0 };

  const items = await getUnprocessedCaItems(maxItems);
  let cards = 0;
  let processed = 0;
  for (const item of items) {
    try {
      const r = await generateCaCards({ caId: item.id, gaConcepts, count: cardsPerItem });
      cards += r.grounded;
      processed++;
    } catch (err) {
      // A transient failure leaves processed_at unset, so the item is retried next
      // night rather than silently lost.
      console.error(`autoGenerateCaCards(${item.id}) failed:`, err);
    }
  }
  return { items: processed, cards };
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
