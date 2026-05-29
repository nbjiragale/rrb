import { query, queryOne, type Executor } from "@/lib/db/client";
import type { PracticeQuestion, Question, QuestionSource } from "@/lib/db/types";

// Only verified questions are served (Hard Rule §2), and never with the answer.
export async function getPracticeQuestions(
  conceptId: number,
  limit = 20
): Promise<PracticeQuestion[]> {
  return query<PracticeQuestion>(
    `SELECT id, concept_id, stem, options
     FROM question
     WHERE concept_id = $1 AND verified = true
     ORDER BY random()
     LIMIT $2`,
    [conceptId, limit]
  );
}

export type GradingRow = Pick<Question, "id" | "concept_id" | "correct_option" | "explanation">;

// Server-authoritative lookup for grading — never trust the client's answer.
export async function getQuestionForGrading(id: number): Promise<GradingRow | null> {
  return queryOne<GradingRow>(
    `SELECT id, concept_id, correct_option, explanation FROM question WHERE id = $1 AND verified = true`,
    [id]
  );
}

export interface MockGradingRow {
  id: number;
  concept_id: number;
  correct_option: number;
  topic: string;
}

// Batch grading lookup (mock submit), with topic for the post-mock breakdown.
export async function getQuestionsForGrading(ids: number[]): Promise<MockGradingRow[]> {
  if (ids.length === 0) return [];
  return query<MockGradingRow>(
    `SELECT q.id, q.concept_id, q.correct_option, c.topic
     FROM question q JOIN concept c ON c.id = q.concept_id
     WHERE q.id = ANY($1) AND q.verified = true`,
    [ids]
  );
}

// C2 — weak-spot targeting: verified questions ordered by concept priority
// (exam_weight × (1 − p_known)), so time goes where it matters most.
export async function getWeakSpotQuestions(limit = 20): Promise<PracticeQuestion[]> {
  return query<PracticeQuestion>(
    `SELECT q.id, q.concept_id, q.stem, q.options
     FROM question q
     JOIN concept c ON c.id = q.concept_id
     LEFT JOIN concept_mastery m ON m.concept_id = c.id
     WHERE q.verified = true
     ORDER BY c.exam_weight * (1 - COALESCE(m.p_known, 0.1)) DESC, random()
     LIMIT $1`,
    [limit]
  );
}

// Mock question selection: verified questions for a subject, random order.
export async function getQuestionsBySubject(
  subject: string,
  limit: number
): Promise<PracticeQuestion[]> {
  return query<PracticeQuestion>(
    `SELECT q.id, q.concept_id, q.stem, q.options
     FROM question q
     JOIN concept c ON c.id = q.concept_id
     WHERE c.subject = $1 AND q.verified = true
     ORDER BY random()
     LIMIT $2`,
    [subject, limit]
  );
}

// A5 — duplicate detection: same concept + same normalized stem.
export async function findDuplicateQuestion(
  conceptId: number,
  stem: string,
  executor?: Executor
): Promise<number | null> {
  const row = await queryOne<{ id: number }>(
    `SELECT id FROM question
     WHERE concept_id = $1 AND lower(btrim(stem)) = lower(btrim($2))
     LIMIT 1`,
    [conceptId, stem],
    executor
  );
  return row?.id ?? null;
}

export async function createQuestion(input: {
  concept_id: number;
  stem: string;
  options: string[];
  correct_option: number;
  explanation?: string | null;
  source: QuestionSource;
  exam_year?: number | null;
  exam_stage?: string | null;
  verified: boolean;
}): Promise<Question> {
  const row = await queryOne<Question>(
    `INSERT INTO question
       (concept_id, stem, options, correct_option, explanation, source, exam_year, exam_stage, verified)
     VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      input.concept_id,
      input.stem,
      JSON.stringify(input.options),
      input.correct_option,
      input.explanation ?? null,
      input.source,
      input.exam_year ?? null,
      input.exam_stage ?? null,
      input.verified,
    ]
  );
  return row!;
}
