import { query, queryOne, type Executor } from "@/lib/db/client";
import type { MockSession, MockType } from "@/lib/db/types";

export async function createMockSession(input: {
  type: MockType;
  total_questions: number;
  time_limit_s: number;
}): Promise<number> {
  const row = await queryOne<{ id: number }>(
    `INSERT INTO mock_session (type, total_questions, time_limit_s)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [input.type, input.total_questions, input.time_limit_s]
  );
  return row!.id;
}

export async function getMockSession(id: number): Promise<MockSession | null> {
  return queryOne<MockSession>(`SELECT * FROM mock_session WHERE id = $1`, [id]);
}

// Idempotency check for imported mocks (migration 0009).
export async function findMockByExternalRef(externalRef: string): Promise<number | null> {
  const row = await queryOne<{ id: number }>(
    `SELECT id FROM mock_session WHERE external_ref = $1`,
    [externalRef]
  );
  return row?.id ?? null;
}

// An imported Testbook mock arrives already completed, so it's inserted in one
// shot (started/completed timestamps from the source) rather than via the
// start→submit flow. Returns the new session id.
export async function createImportedMockSession(
  input: {
    type: MockType;
    external_ref: string;
    taken_at: string | null;
    total_questions: number;
    attempted_count: number;
    score: number;
    accuracy: number;
    total_time_s: number | null;
    pacing_data: { q: number; cumulative_ms: number }[];
  },
  executor?: Executor
): Promise<number> {
  const row = await queryOne<{ id: number }>(
    `INSERT INTO mock_session
       (type, external_ref, started_at, completed_at, total_questions,
        attempted_count, score, accuracy, time_limit_s, pacing_data)
     VALUES ($1, $2, COALESCE($3::timestamptz, now()), COALESCE($3::timestamptz, now()),
             $4, $5, $6, $7, $8, $9::jsonb)
     RETURNING id`,
    [
      input.type,
      input.external_ref,
      input.taken_at,
      input.total_questions,
      input.attempted_count,
      input.score,
      input.accuracy,
      input.total_time_s,
      JSON.stringify(input.pacing_data),
    ],
    executor
  );
  return row!.id;
}

export async function completeMockSession(
  id: number,
  input: {
    attempted_count: number;
    score: number;
    accuracy: number;
    pacing_data: { q: number; cumulative_ms: number }[];
  },
  executor?: Executor
): Promise<void> {
  await query(
    `UPDATE mock_session
       SET completed_at = now(), attempted_count = $2, score = $3,
           accuracy = $4, pacing_data = $5::jsonb
     WHERE id = $1`,
    [id, input.attempted_count, input.score, input.accuracy, JSON.stringify(input.pacing_data)],
    executor
  );
}
