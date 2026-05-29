import { query, queryOne, type Executor } from "@/lib/db/client";
import type { ConceptMastery } from "@/lib/db/types";

export async function getMastery(
  conceptId: number,
  executor?: Executor
): Promise<ConceptMastery | null> {
  return queryOne<ConceptMastery>(
    `SELECT * FROM concept_mastery WHERE concept_id = $1`,
    [conceptId],
    executor
  );
}

// Lock the row for a read-modify-write inside a transaction (BKT update).
export async function getMasteryForUpdate(
  conceptId: number,
  executor: Executor
): Promise<ConceptMastery | null> {
  return queryOne<ConceptMastery>(
    `SELECT * FROM concept_mastery WHERE concept_id = $1 FOR UPDATE`,
    [conceptId],
    executor
  );
}

export async function upsertMastery(row: ConceptMastery, executor?: Executor): Promise<void> {
  await query(
    `INSERT INTO concept_mastery
       (concept_id, attempts, correct, wrong, p_known, avg_confidence, mastery_level, last_seen_at, last_correct_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (concept_id) DO UPDATE SET
       attempts = $2, correct = $3, wrong = $4, p_known = $5,
       avg_confidence = $6, mastery_level = $7, last_seen_at = $8, last_correct_at = $9`,
    [
      row.concept_id,
      row.attempts,
      row.correct,
      row.wrong,
      row.p_known,
      row.avg_confidence,
      row.mastery_level,
      row.last_seen_at,
      row.last_correct_at,
    ],
    executor
  );
}

export async function listMastery(): Promise<ConceptMastery[]> {
  return query<ConceptMastery>(`SELECT * FROM concept_mastery`);
}

export interface WeakConcept {
  concept_id: number;
  name: string;
  subject: string;
  topic: string;
  p_known: number;
  exam_weight: number;
  priority: number;
}

// C2 — weak-spot targeting: lowest p_known × highest exam_weight first.
// Concepts with no mastery row default to p_known = 0.1 (treated as weak).
export async function listWeakConcepts(limit = 20): Promise<WeakConcept[]> {
  return query<WeakConcept>(
    `SELECT c.id AS concept_id, c.name, c.subject, c.topic,
            COALESCE(m.p_known, 0.1) AS p_known,
            c.exam_weight,
            c.exam_weight * (1 - COALESCE(m.p_known, 0.1)) AS priority
     FROM concept c
     LEFT JOIN concept_mastery m ON m.concept_id = c.id
     WHERE EXISTS (SELECT 1 FROM question q WHERE q.concept_id = c.id AND q.verified = true)
     ORDER BY priority DESC
     LIMIT $1`,
    [limit]
  );
}
