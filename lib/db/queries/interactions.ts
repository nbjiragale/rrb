import { query, queryOne } from "@/lib/db/client";
import { toVectorLiteral } from "@/lib/llm/embed";
import type { Interaction, InteractionType } from "@/lib/db/types";

// Semantic memory layer (architecture §8). APPEND-ONLY (Hard Rule §6).

export async function insertInteraction(input: {
  type: InteractionType;
  concept_id: number | null;
  content: string;
  ai_feedback?: string | null;
  embedding: number[] | null;
}): Promise<Interaction> {
  const row = await queryOne<Interaction>(
    `INSERT INTO interaction (type, concept_id, content, ai_feedback, embedding)
     VALUES ($1, $2, $3, $4, ${input.embedding ? "$5::vector" : "NULL"})
     RETURNING id, type, concept_id, content, ai_feedback, created_at`,
    input.embedding
      ? [input.type, input.concept_id, input.content, input.ai_feedback ?? null, toVectorLiteral(input.embedding)]
      : [input.type, input.concept_id, input.content, input.ai_feedback ?? null]
  );
  return row!;
}

export interface SemanticMatch {
  id: number;
  type: InteractionType;
  concept_id: number | null;
  content: string;
  ai_feedback: string | null;
  created_at: string;
  similarity: number;
}

// J2 — top-k cosine recall over embedded interactions. (1 − distance) similarity.
export async function searchInteractions(
  embedding: number[],
  limit = 5
): Promise<SemanticMatch[]> {
  return query<SemanticMatch>(
    `SELECT id, type, concept_id, content, ai_feedback, created_at,
            1 - (embedding <=> $1::vector) AS similarity
     FROM interaction
     WHERE embedding IS NOT NULL
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    [toVectorLiteral(embedding), limit]
  );
}

export async function listInteractionsByConcept(
  conceptId: number,
  type?: InteractionType
): Promise<Interaction[]> {
  return query<Interaction>(
    `SELECT id, type, concept_id, content, ai_feedback, created_at
     FROM interaction
     WHERE concept_id = $1 ${type ? "AND type = $2" : ""}
     ORDER BY created_at DESC`,
    type ? [conceptId, type] : [conceptId]
  );
}

// Nightly backfill (walkthrough C.5): interactions stored before embeddings were
// available / configured.
export async function getUnembeddedInteractions(limit = 100): Promise<{ id: number; content: string }[]> {
  return query<{ id: number; content: string }>(
    `SELECT id, content FROM interaction WHERE embedding IS NULL ORDER BY created_at ASC LIMIT $1`,
    [limit]
  );
}

export async function setInteractionEmbedding(id: number, embedding: number[]): Promise<void> {
  await query(`UPDATE interaction SET embedding = $2::vector WHERE id = $1`, [
    id,
    toVectorLiteral(embedding),
  ]);
}
