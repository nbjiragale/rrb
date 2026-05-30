import { query } from "@/lib/db/client";

// Read-only dashboard aggregates (Epic J). No writes here.

export interface HeatmapCell {
  concept_id: number;
  name: string;
  subject: string;
  topic: string;
  p_known: number;
  attempts: number;
}

// J1 — every concept with its current p_known (default 0.1 if never attempted),
// ordered for a subject→topic grid.
export async function getHeatmap(): Promise<HeatmapCell[]> {
  return query<HeatmapCell>(
    `SELECT c.id AS concept_id, c.name, c.subject, c.topic,
            COALESCE(m.p_known, 0.1) AS p_known,
            COALESCE(m.attempts, 0) AS attempts
     FROM concept c
     LEFT JOIN concept_mastery m ON m.concept_id = c.id
     ORDER BY c.subject, c.topic, c.name`
  );
}

export interface CoverageRow {
  subject: string;
  total: number;
  seen: number;
  in_progress: number;
  mastered: number;
}

// J5 — syllabus coverage by subject. "seen" = any attempt; "mastered" = level
// mastered; "in_progress" = seen but not yet mastered.
export async function getCoverage(): Promise<CoverageRow[]> {
  return query<CoverageRow>(
    `SELECT c.subject,
            count(*)::int AS total,
            count(m.concept_id) FILTER (WHERE m.attempts > 0)::int AS seen,
            count(m.concept_id) FILTER (WHERE m.attempts > 0 AND m.mastery_level <> 'mastered')::int AS in_progress,
            count(m.concept_id) FILTER (WHERE m.mastery_level = 'mastered')::int AS mastered
     FROM concept c
     LEFT JOIN concept_mastery m ON m.concept_id = c.id
     GROUP BY c.subject
     ORDER BY c.subject`
  );
}

// J4 — distinct days with at least one review, for the streak computation.
export async function getReviewDays(): Promise<string[]> {
  const rows = await query<{ day: string }>(
    `SELECT DISTINCT reviewed_at::date::text AS day FROM review ORDER BY day`
  );
  return rows.map((r) => r.day);
}

export interface ReadinessConceptRow {
  p_known: number;
  exam_weight: number;
  attempted: boolean;
}

// J3 — per-concept inputs: predicted accuracy weight + whether it's been seen.
export async function getReadinessConcepts(): Promise<ReadinessConceptRow[]> {
  return query<ReadinessConceptRow>(
    `SELECT COALESCE(m.p_known, 0.1) AS p_known,
            c.exam_weight,
            COALESCE(m.attempts, 0) > 0 AS attempted
     FROM concept c
     LEFT JOIN concept_mastery m ON m.concept_id = c.id`
  );
}

// J3 — recent completed mocks as score fraction = score / total_questions.
export async function getRecentMockFractions(limit = 5): Promise<number[]> {
  const rows = await query<{ frac: number }>(
    `SELECT (score / NULLIF(total_questions, 0))::float AS frac
     FROM mock_session
     WHERE completed_at IS NOT NULL AND score IS NOT NULL AND total_questions > 0
     ORDER BY completed_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows.map((r) => r.frac).filter((f) => f != null);
}
