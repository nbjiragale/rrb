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
