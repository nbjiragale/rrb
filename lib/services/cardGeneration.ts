import { z } from "zod";
import { complete } from "@/lib/llm/router";
import { parseJson } from "@/lib/llm/json";
import {
  buildFactCardSystemPrompt,
  buildFactCardUserPrompt,
  buildPassageCardSystemPrompt,
  buildPassageCardUserPrompt,
} from "@/lib/llm/prompts/generate";
import { verifyFactCards, verifyGroundedCards, type GeneratedCard } from "@/lib/llm/verify";
import { genTokens } from "@/lib/config";
import { getConcept } from "@/lib/db/queries/concepts";
import { createCard } from "@/lib/db/queries/cards";

// On-demand flashcard generation for a concept. Mirrors the question generator:
// math/reasoning is generated freely then independently fact-checked; GA is
// generated ONLY from a pasted passage and re-grounded against it (Hard Rule
// §2.1). Only cards that clear the check are saved — the rest are dropped.

const cardsSchema = z.array(
  z.object({ front: z.string().min(1), back: z.string().min(1) })
);

export interface CardGenReport {
  generated: number;
  created: number;
  cardIds: number[];
}

// Math/reasoning recall cards (formulas, rules, method steps). Free generation,
// each card's back independently confirmed correct before it's saved.
export async function generateFactCards(input: {
  conceptId: number;
  count: number;
}): Promise<CardGenReport> {
  const concept = await getConcept(input.conceptId);
  if (!concept) throw new Error(`Concept ${input.conceptId} not found`);
  if (concept.subject === "ga") {
    throw new Error("GA concepts need a source passage — use grounded card generation.");
  }

  const raw = await complete({
    system: buildFactCardSystemPrompt(),
    messages: [
      {
        role: "user",
        content: buildFactCardUserPrompt({
          conceptName: concept.name,
          topic: concept.topic,
          subject: concept.subject,
          count: input.count,
        }),
      },
    ],
    task: "generate",
    maxTokens: genTokens(input.count),
    reasoning: { enabled: false },
  });

  const candidates = parseJson(raw, cardsSchema);
  const verified = await verifyFactCards(candidates);
  return persistCards(verified, candidates.length, input.conceptId, `generated:${concept.subject}`);
}

// GA recall cards grounded strictly in a pasted passage. Ungrounded GA is
// impossible by construction: an empty passage throws before any model call.
export async function generateGroundedCards(input: {
  conceptId: number;
  sourceText: string;
  count: number;
}): Promise<CardGenReport> {
  if (!input.sourceText?.trim()) {
    throw new Error("GA card generation requires source text — ungrounded GA is not allowed.");
  }
  const concept = await getConcept(input.conceptId);
  if (!concept) throw new Error(`Concept ${input.conceptId} not found`);
  if (concept.subject !== "ga") {
    throw new Error("Grounded card generation is only for GA concepts.");
  }

  const raw = await complete({
    system: buildPassageCardSystemPrompt(),
    messages: [
      {
        role: "user",
        content: buildPassageCardUserPrompt({
          conceptName: concept.name,
          sourceText: input.sourceText,
          count: input.count,
        }),
      },
    ],
    task: "generate",
    maxTokens: genTokens(input.count),
    reasoning: { enabled: false },
  });

  const candidates = parseJson(raw, cardsSchema);
  const grounded = await verifyGroundedCards(candidates, input.sourceText);
  return persistCards(grounded, candidates.length, input.conceptId, "passage");
}

async function persistCards(
  cards: GeneratedCard[],
  generated: number,
  conceptId: number,
  sourceRef: string
): Promise<CardGenReport> {
  const cardIds: number[] = [];
  for (const c of cards) {
    const card = await createCard({
      concept_id: conceptId,
      front: c.front,
      back: c.back,
      card_type: "recall",
      source_ref: sourceRef,
    });
    cardIds.push(card.id);
  }
  return { generated, created: cardIds.length, cardIds };
}
