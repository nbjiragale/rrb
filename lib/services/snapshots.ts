import { bktUpdate, masteryLevel } from "@/lib/bkt";
import {
  upsertTodaySnapshot,
  hasSnapshots,
  getGradedAttemptsChrono,
  insertSnapshotsIfAbsent,
} from "@/lib/db/queries/snapshots";
import type { MasterySnapshot } from "@/lib/db/types";

const DEFAULT_P_KNOWN = 0.1;

// J2 — nightly: reconstruct any missing mastery history from the append-only
// attempt log (once, gaps only), then write today's live snapshot. Replaying
// BKT here mirrors the write path exactly (lib/services/attempt.ts), so the
// historical p_known matches what the live model produced.
export async function recordDailySnapshots(): Promise<{ backfilled: number; today: number }> {
  let backfilled = 0;
  if (!(await hasSnapshots())) {
    backfilled = await backfillFromAttempts();
  }
  const today = await upsertTodaySnapshot();
  return { backfilled, today };
}

// Replay graded attempts per concept; emit one snapshot per concept per day,
// using that day's last computed p_known.
export async function backfillFromAttempts(): Promise<number> {
  const attempts = await getGradedAttemptsChrono();
  if (attempts.length === 0) return 0;

  const pByConcept = new Map<number, number>();
  // Keyed "conceptId|day" → end-of-day p_known.
  const dayValue = new Map<string, { concept_id: number; day: string; p: number }>();

  for (const a of attempts) {
    const prev = pByConcept.get(a.concept_id) ?? DEFAULT_P_KNOWN;
    const next = bktUpdate(prev, a.is_correct);
    pByConcept.set(a.concept_id, next);
    dayValue.set(`${a.concept_id}|${a.day}`, { concept_id: a.concept_id, day: a.day, p: next });
  }

  const rows: MasterySnapshot[] = [...dayValue.values()].map((v) => ({
    concept_id: v.concept_id,
    snapshot_date: v.day,
    p_known: v.p,
    mastery_level: masteryLevel(v.p),
  }));

  return insertSnapshotsIfAbsent(rows);
}
