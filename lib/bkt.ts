// Bayesian Knowledge Tracing — the student model. Pure functions, no I/O,
// so they're trivially unit-testable. See CLAUDE.md §7.

import type { MasteryLevel } from "@/lib/db/types";

export interface BktParams {
  /** P(transition): chance of learning the skill on an attempt. */
  pT: number;
  /** P(slip): knows it but answers wrong. */
  pS: number;
  /** P(guess): doesn't know it but answers right. */
  pG: number;
}

export const DEFAULT_BKT: BktParams = { pT: 0.15, pS: 0.1, pG: 0.25 };

// p_known is a probability and is fed back into the next update, so a single
// out-of-range value would compound and silently corrupt a concept's mastery
// forever. Clamp every result into the open interval (matched by a CHECK
// constraint on concept_mastery.p_known) so bad numbers can't propagate.
function clampProb(x: number): number {
  if (!Number.isFinite(x)) return 0.1; // NaN/Infinity → treat as a fresh prior
  return Math.min(1 - 1e-6, Math.max(1e-6, x));
}

/** Updated P(known) after observing one answer. */
export function bktUpdate(pKnown: number, correct: boolean, params: BktParams = DEFAULT_BKT): number {
  const { pT, pS, pG } = params;
  const p = clampProb(pKnown);
  const posterior = correct
    ? (p * (1 - pS)) / (p * (1 - pS) + (1 - p) * pG)
    : (p * pS) / (p * pS + (1 - p) * (1 - pG));
  return clampProb(posterior + (1 - posterior) * pT);
}

/** Predicted probability the next answer is correct. */
export function predictCorrect(pKnown: number, params: BktParams = DEFAULT_BKT): number {
  return pKnown * (1 - params.pS) + (1 - pKnown) * params.pG;
}

/** Derived bucket from P(known) for display/heatmaps. */
export function masteryLevel(pKnown: number): MasteryLevel {
  if (pKnown >= 0.85) return "mastered";
  if (pKnown >= 0.6) return "review";
  if (pKnown >= 0.3) return "learning";
  return "new";
}
