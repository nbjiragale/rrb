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
