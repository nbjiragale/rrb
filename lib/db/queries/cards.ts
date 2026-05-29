import { query, queryOne } from "@/lib/db/client";
import type { Card, CardType, DueCard } from "@/lib/db/types";

// B1 — the due queue: cards with due_at <= now, plus brand-new cards.
// Ordered: overdue first, then new. (B3 new-card cap is applied by the caller.)
export async function getDueCards(limit = 100): Promise<DueCard[]> {
  return query<DueCard>(
    `SELECT c.*, k.name AS concept_name, k.subject, k.topic
     FROM card c
     JOIN concept k ON k.id = c.concept_id
     WHERE c.state = 'new' OR c.due_at <= now()
     ORDER BY (c.state = 'new') ASC, c.due_at ASC NULLS LAST
     LIMIT $1`,
    [limit]
  );
}

export async function countDue(): Promise<{ due: number; newCount: number }> {
  const row = await queryOne<{ due: string; new_count: string }>(
    `SELECT
       count(*) FILTER (WHERE state <> 'new' AND due_at <= now()) AS due,
       count(*) FILTER (WHERE state = 'new') AS new_count
     FROM card`
  );
  return { due: Number(row?.due ?? 0), newCount: Number(row?.new_count ?? 0) };
}

export async function getCard(id: number): Promise<Card | null> {
  return queryOne<Card>(`SELECT * FROM card WHERE id = $1`, [id]);
}

export async function listCards(): Promise<DueCard[]> {
  return query<DueCard>(
    `SELECT c.*, k.name AS concept_name, k.subject, k.topic
     FROM card c
     JOIN concept k ON k.id = c.concept_id
     ORDER BY c.created_at DESC`
  );
}

export async function createCard(input: {
  concept_id: number;
  front: string;
  back: string;
  card_type: CardType;
  source_ref?: string | null;
}): Promise<Card> {
  const row = await queryOne<Card>(
    `INSERT INTO card (concept_id, front, back, card_type, source_ref, state)
     VALUES ($1, $2, $3, $4, $5, 'new')
     RETURNING *`,
    [input.concept_id, input.front, input.back, input.card_type, input.source_ref ?? null]
  );
  return row!;
}

// Update derived FSRS state on a card. The raw event is logged separately in `review`.
export async function applySchedule(
  id: number,
  s: {
    stability: number;
    difficulty: number;
    state: string;
    due_at: Date;
    last_review: Date;
    reps: number;
    lapses: number;
  }
): Promise<void> {
  await query(
    `UPDATE card
       SET stability = $2, difficulty = $3, state = $4,
           due_at = $5, last_review = $6, reps = $7, lapses = $8
     WHERE id = $1`,
    [id, s.stability, s.difficulty, s.state, s.due_at, s.last_review, s.reps, s.lapses]
  );
}
