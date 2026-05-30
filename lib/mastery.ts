// Pure mastery-display helpers (no I/O). The 0–4 bucket maps p_known onto the
// --mastery-0..4 token scale used by the heatmap and trend chart (CLAUDE.md §6).

export type MasteryBucket = 0 | 1 | 2 | 3 | 4;

// Five bands across [0,1]. 0 = untouched/very weak, 4 = mastered. Aligned with
// bkt.ts masteryLevel thresholds so colours and labels tell the same story.
export function masteryBucket(pKnown: number): MasteryBucket {
  if (pKnown >= 0.85) return 4;
  if (pKnown >= 0.6) return 3;
  if (pKnown >= 0.3) return 2;
  if (pKnown >= 0.1) return 1;
  return 0;
}

export const MASTERY_LABEL: Record<MasteryBucket, string> = {
  0: "untouched",
  1: "weak",
  2: "learning",
  3: "strong",
  4: "mastered",
};
