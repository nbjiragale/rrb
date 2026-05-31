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
       (concept_id, attempts, correct, wrong, p_known, avg_confidence, confidence_count, mastery_level, last_seen_at, last_correct_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (concept_id) DO UPDATE SET
       attempts = $2, correct = $3, wrong = $4, p_known = $5,
       avg_confidence = $6, confidence_count = $7, mastery_level = $8,
       last_seen_at = $9, last_correct_at = $10`,
    [
      row.concept_id,
      row.attempts,
      row.correct,
      row.wrong,
      row.p_known,
      row.avg_confidence,
      row.confidence_count,
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

// Nightly (walkthrough C): per-concept calibration error = |normed avg confidence
// − accuracy|, computed straight from the append-only attempt log. Returns the
// number of concepts updated.
export async function recomputeCalibrationError(): Promise<number> {
  const rows = await query<{ concept_id: number }>(
    `WITH stats AS (
       SELECT concept_id,
              avg((confidence - 1) / 4.0) AS conf_norm,
              avg(CASE WHEN is_correct THEN 1.0 ELSE 0.0 END) AS accuracy
       FROM attempt
       WHERE confidence IS NOT NULL AND is_correct IS NOT NULL
       GROUP BY concept_id
     )
     UPDATE concept_mastery m
       SET calibration_error = abs(stats.conf_norm - stats.accuracy)
     FROM stats
     WHERE m.concept_id = stats.concept_id
     RETURNING m.concept_id`
  );
  return rows.length;
}

export interface WeakConceptBrief {
  concept_id: number;
  name: string;
  subject: string;
  p_known: number;
}

// Lowest-mastery attempted concepts — the profile's "focus areas" (J3).
export async function getWeakConcepts(limit = 5): Promise<WeakConceptBrief[]> {
  return query<WeakConceptBrief>(
    `SELECT m.concept_id, c.name, c.subject, m.p_known
     FROM concept_mastery m
     JOIN concept c ON c.id = m.concept_id
     WHERE m.attempts > 0
     ORDER BY m.p_known ASC
     LIMIT $1`,
    [limit]
  );
}

export async function getMasteryCounts(): Promise<{
  tracked: number;
  mastered: number;
  attempts: number;
}> {
  const row = await queryOne<{ tracked: string; mastered: string; attempts: string }>(
    `SELECT count(*) AS tracked,
            count(*) FILTER (WHERE mastery_level = 'mastered') AS mastered,
            COALESCE(sum(attempts), 0) AS attempts
     FROM concept_mastery`
  );
  return {
    tracked: Number(row?.tracked ?? 0),
    mastered: Number(row?.mastered ?? 0),
    attempts: Number(row?.attempts ?? 0),
  };
}
