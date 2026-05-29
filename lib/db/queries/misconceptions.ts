import { query, queryOne, type Executor } from "@/lib/db/client";
import type { MisconceptionKind } from "@/lib/db/types";

// Diagnosis layer (architecture §9 step 2): AI interprets, code stores.

// Find-or-create a misconception for a concept. A repeated label increments a
// count downstream rather than spawning a duplicate, so the dashboard can say
// "confused 72/161 ×3". Description/kind come from the first diagnosis.
export async function upsertMisconception(
  input: { concept_id: number; label: string; description: string; kind: MisconceptionKind },
  executor?: Executor
): Promise<number> {
  const row = await queryOne<{ id: number }>(
    `INSERT INTO misconception (concept_id, label, description, kind)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (concept_id, label) DO UPDATE SET label = EXCLUDED.label
     RETURNING id`,
    [input.concept_id, input.label, input.description, input.kind],
    executor
  );
  return row!.id;
}

export async function insertMisconceptionHit(
  input: {
    attempt_id: number;
    misconception_id: number;
    ai_confidence: number | null;
    ai_rationale: string | null;
  },
  executor?: Executor
): Promise<void> {
  await query(
    `INSERT INTO misconception_hit (attempt_id, misconception_id, ai_confidence, ai_rationale)
     VALUES ($1, $2, $3, $4)`,
    [input.attempt_id, input.misconception_id, input.ai_confidence, input.ai_rationale],
    executor
  );
}

// Idempotency guard (F1): a wrong attempt is diagnosed at most once, whether the
// trigger is the practice UI or the nightly sweep.
export async function hasDiagnosis(attemptId: number): Promise<boolean> {
  const row = await queryOne<{ one: number }>(
    `SELECT 1 AS one FROM misconception_hit WHERE attempt_id = $1 LIMIT 1`,
    [attemptId]
  );
  return row !== null;
}

export interface RecurringMisconception {
  concept_id: number;
  concept_name: string;
  subject: string;
  label: string;
  description: string;
  kind: MisconceptionKind;
  hit_count: number;
  last_seen: string;
  sample_attempt_id: number; // a representative wrong attempt, for adversarial drills (C5)
}

// F2 — per-concept recurring misconceptions with counts, most-hit first.
export async function getRecurringMisconceptions(): Promise<RecurringMisconception[]> {
  return query<RecurringMisconception>(
    `SELECT m.concept_id, c.name AS concept_name, c.subject, m.label, m.description, m.kind,
            count(h.id)::int AS hit_count, max(h.diagnosed_at) AS last_seen,
            max(h.attempt_id) AS sample_attempt_id
     FROM misconception m
     JOIN concept c ON c.id = m.concept_id
     JOIN misconception_hit h ON h.misconception_id = m.id
     GROUP BY m.id, c.name, c.subject
     ORDER BY m.concept_id, hit_count DESC`
  );
}

export interface AttemptMisconception {
  label: string;
  description: string;
  kind: MisconceptionKind;
}

// The (most recent) misconception diagnosed for a given attempt — the seed for
// an adversarial variant (C5).
export async function getMisconceptionForAttempt(
  attemptId: number
): Promise<AttemptMisconception | null> {
  return queryOne<AttemptMisconception>(
    `SELECT m.label, m.description, m.kind
     FROM misconception_hit h
     JOIN misconception m ON m.id = h.misconception_id
     WHERE h.attempt_id = $1
     ORDER BY h.diagnosed_at DESC
     LIMIT 1`,
    [attemptId]
  );
}

export interface KindCount {
  subject: string;
  kind: MisconceptionKind;
  hit_count: number;
}

// F3 — error-kind distribution per subject (different kinds imply different fixes).
export async function getKindDistribution(): Promise<KindCount[]> {
  return query<KindCount>(
    `SELECT c.subject, m.kind, count(h.id)::int AS hit_count
     FROM misconception m
     JOIN concept c ON c.id = m.concept_id
     JOIN misconception_hit h ON h.misconception_id = m.id
     GROUP BY c.subject, m.kind
     ORDER BY c.subject, hit_count DESC`
  );
}
