import { tryEmbed } from "@/lib/llm/embed";
import {
  insertInteraction,
  searchInteractions,
  textSearchInteractions,
  type SemanticMatch,
} from "@/lib/db/queries/interactions";
import type { Interaction, InteractionType } from "@/lib/db/types";

// Learner memory domain (architecture §8 semantic layer). All writes are
// append-only (Hard Rule §6); recall is selective top-k, never a dump (Rule §7).

// J2 — a free-form study note saved as recallable semantic memory. Embedded now
// if a provider is configured; otherwise stored and embedded by the nightly
// backfill (architecture §9 step 5), so the note is never lost.
export async function saveNote(input: {
  conceptId: number | null;
  content: string;
}): Promise<Interaction> {
  const embedding = await tryEmbed(input.content);
  return insertInteraction({
    type: "note",
    concept_id: input.conceptId,
    content: input.content,
    ai_feedback: null,
    embedding,
  });
}

export interface RecallResult {
  mode: "semantic" | "text";
  matches: SemanticMatch[];
}

// J2 — recall the learner's own past words across notes, doubts, and Feynman
// explanations. Semantic (pgvector cosine) when an embedding provider is
// configured; otherwise a keyword fallback so the feature still works.
export async function recallMemory(input: {
  query: string;
  limit?: number;
  type?: InteractionType | null;
}): Promise<RecallResult> {
  const limit = input.limit ?? 8;
  const type = input.type ?? null;
  const embedding = await tryEmbed(input.query);
  if (embedding) {
    return { mode: "semantic", matches: await searchInteractions(embedding, limit, type) };
  }
  return { mode: "text", matches: await textSearchInteractions(input.query, limit, type) };
}
