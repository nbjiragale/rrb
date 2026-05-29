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
