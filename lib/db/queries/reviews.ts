import { query } from "@/lib/db/client";
import type { Rating } from "@/lib/db/types";

// APPEND-ONLY (Hard Rule §6). Every review event is logged; never updated/deleted.
export async function logReview(input: {
  card_id: number;
  rating: Rating;
  response_ms: number | null;
  prev_stability: number | null;
  new_stability: number;
  new_due_at: Date;
}): Promise<void> {
  await query(
    `INSERT INTO review (card_id, rating, response_ms, prev_stability, new_stability, new_due_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      input.card_id,
      input.rating,
      input.response_ms,
      input.prev_stability,
      input.new_stability,
      input.new_due_at,
    ]
  );
}

export async function countReviewsToday(): Promise<number> {
  const rows = await query<{ n: string }>(
    `SELECT count(*) AS n FROM review WHERE reviewed_at::date = now()::date`
  );
  return Number(rows[0]?.n ?? 0);
}
