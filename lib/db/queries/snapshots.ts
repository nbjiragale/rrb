import { query, queryOne } from "@/lib/db/client";
import type { MasterySnapshot } from "@/lib/db/types";

// J2 — append-only daily mastery history. Idempotent per (concept, day).

// Write today's snapshot straight from the live student model. ON CONFLICT keeps
// the latest value for the day (the one allowed update to derived state).
export async function upsertTodaySnapshot(): Promise<number> {
  const rows = await query<{ concept_id: number }>(
    `INSERT INTO concept_mastery_snapshot (concept_id, snapshot_date, p_known, mastery_level)
     SELECT concept_id, current_date, p_known, mastery_level
     FROM concept_mastery
     ON CONFLICT (concept_id, snapshot_date)
       DO UPDATE SET p_known = EXCLUDED.p_known, mastery_level = EXCLUDED.mastery_level
     RETURNING concept_id`
  );
  return rows.length;
}

export async function hasSnapshots(): Promise<boolean> {
  const row = await queryOne<{ one: number }>(`SELECT 1 AS one FROM concept_mastery_snapshot LIMIT 1`);
  return row !== null;
}

// Graded attempts in chronological order — the source for replaying BKT to
// reconstruct historical p_known (backfill). One row per attempt.
export interface AttemptDay {
  concept_id: number;
  day: string; // YYYY-MM-DD
  is_correct: boolean;
}

export async function getGradedAttemptsChrono(): Promise<AttemptDay[]> {
  return query<AttemptDay>(
    `SELECT concept_id, attempted_at::date::text AS day, is_correct
     FROM attempt
     WHERE is_correct IS NOT NULL
     ORDER BY attempted_at ASC`
  );
}

// Bulk insert reconstructed history; never clobbers a real snapshot already
// present (DO NOTHING), so it only fills gaps.
export async function insertSnapshotsIfAbsent(rows: MasterySnapshot[]): Promise<number> {
  let inserted = 0;
  for (const r of rows) {
    const res = await queryOne<{ concept_id: number }>(
      `INSERT INTO concept_mastery_snapshot (concept_id, snapshot_date, p_known, mastery_level)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (concept_id, snapshot_date) DO NOTHING
       RETURNING concept_id`,
      [r.concept_id, r.snapshot_date, r.p_known, r.mastery_level]
    );
    if (res) inserted++;
  }
  return inserted;
}

export interface TopicTrendPoint {
  topic: string;
  subject: string;
  snapshot_date: string;
  avg_p_known: number;
}

// J2 — average p_known per topic across the last N weeks of snapshots, one point
// per topic per day that has data.
export async function getTopicTrends(weeks = 8): Promise<TopicTrendPoint[]> {
  return query<TopicTrendPoint>(
    `SELECT c.topic, c.subject, s.snapshot_date::text AS snapshot_date,
            avg(s.p_known)::float AS avg_p_known
     FROM concept_mastery_snapshot s
     JOIN concept c ON c.id = s.concept_id
     WHERE s.snapshot_date >= current_date - ($1 * 7)
     GROUP BY c.topic, c.subject, s.snapshot_date
     ORDER BY c.subject, c.topic, s.snapshot_date`,
    [weeks]
  );
}
