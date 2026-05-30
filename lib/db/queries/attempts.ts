import { query, queryOne, type Executor } from "@/lib/db/client";
import type { AttemptContext, Confidence } from "@/lib/db/types";

// APPEND-ONLY (Hard Rule §6). Accepts an executor so it can join a transaction.
export async function insertAttempt(
  input: {
    question_id: number;
    concept_id: number;
    mock_session_id?: number | null;
    selected_option: number | null;
    is_correct: boolean | null;
    confidence: Confidence | null;
    time_taken_ms: number | null;
    context: AttemptContext;
  },
  executor?: Executor
): Promise<number> {
  const row = await queryOne<{ id: number }>(
    `INSERT INTO attempt
       (question_id, concept_id, mock_session_id, selected_option, is_correct, confidence, time_taken_ms, context)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      input.question_id,
      input.concept_id,
      input.mock_session_id ?? null,
      input.selected_option,
      input.is_correct,
      input.confidence,
      input.time_taken_ms,
      input.context,
    ],
    executor
  );
  return row!.id;
}

export interface AttemptForDiagnosis {
  attempt_id: number;
  concept_id: number;
  concept_name: string;
  subject: string;
  question_id: number;
  stem: string;
  options: string[];
  correct_option: number;
  selected_option: number | null;
  selected_text: string | null;
  correct_text: string;
  is_correct: boolean | null;
  confidence: number | null;
}

// Everything the diagnosis LLM call needs about one wrong attempt (F1).
export async function getAttemptForDiagnosis(
  attemptId: number
): Promise<AttemptForDiagnosis | null> {
  return queryOne<AttemptForDiagnosis>(
    `SELECT a.id AS attempt_id, a.concept_id, c.name AS concept_name, c.subject,
            q.id AS question_id, q.stem, q.options, q.correct_option,
            a.selected_option,
            CASE WHEN a.selected_option IS NULL THEN NULL
                 ELSE q.options ->> a.selected_option END AS selected_text,
            q.options ->> q.correct_option AS correct_text,
            a.is_correct, a.confidence
     FROM attempt a
     JOIN question q ON q.id = a.question_id
     JOIN concept c ON c.id = a.concept_id
     WHERE a.id = $1`,
    [attemptId]
  );
}

// Nightly safety net (F1): wrong attempts with no diagnosis yet, newest first.
// Bounded by the caller to keep LLM cost in check (Hard Rule §4).
export async function getUndiagnosedWrongAttempts(limit = 50): Promise<{ id: number }[]> {
  return query<{ id: number }>(
    `SELECT a.id
     FROM attempt a
     LEFT JOIN misconception_hit h ON h.attempt_id = a.id
     WHERE a.is_correct = false AND h.id IS NULL
     ORDER BY a.attempted_at DESC
     LIMIT $1`,
    [limit]
  );
}

export interface ConfidentWrong {
  attempt_id: number;
  concept_id: number;
  concept_name: string;
  stem: string;
  selected_text: string | null;
  correct_text: string;
  confidence: number;
  attempted_at: string;
}

// G4 — high-confidence wrong answers: the most dangerous gaps (sure, but wrong).
export async function getConfidentWrongAttempts(
  minConfidence = 4,
  limit = 20
): Promise<ConfidentWrong[]> {
  return query<ConfidentWrong>(
    `SELECT a.id AS attempt_id, a.concept_id, c.name AS concept_name, q.stem,
            CASE WHEN a.selected_option IS NULL THEN NULL
                 ELSE q.options ->> a.selected_option END AS selected_text,
            q.options ->> q.correct_option AS correct_text,
            a.confidence, a.attempted_at
     FROM attempt a
     JOIN question q ON q.id = a.question_id
     JOIN concept c ON c.id = a.concept_id
     WHERE a.is_correct = false AND a.confidence >= $1
     ORDER BY a.confidence DESC, a.attempted_at DESC
     LIMIT $2`,
    [minConfidence, limit]
  );
}

export interface RecentError {
  attempted_at: string;
  stem: string;
  selected_text: string | null;
  correct_text: string;
}

// Recent wrong attempts for a concept, with the chosen vs correct option text.
// In v2 this is the tutor's "recent errors" signal; v4 enriches it with misconceptions.
export async function getRecentErrors(conceptId: number, limit = 5): Promise<RecentError[]> {
  return query<RecentError>(
    `SELECT a.attempted_at,
            q.stem,
            CASE WHEN a.selected_option IS NULL THEN NULL
                 ELSE q.options ->> a.selected_option END AS selected_text,
            q.options ->> q.correct_option AS correct_text
     FROM attempt a
     JOIN question q ON q.id = a.question_id
     WHERE a.concept_id = $1 AND a.is_correct = false
     ORDER BY a.attempted_at DESC
     LIMIT $2`,
    [conceptId, limit]
  );
}
