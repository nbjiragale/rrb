// Mock scoring — pure (CLAUDE.md §7). Negative marking with first-class skips.

export interface ScoredAnswer {
  /** null = skipped (first-class, never penalized). */
  selectedOption: number | null;
  isCorrect: boolean;
}

export interface MockScore {
  score: number;
  correct: number;
  wrong: number;
  skipped: number;
  attempted: number;
  accuracy: number;
  /** Marks lost to wrong answers (the negative-marking penalty). */
  marksLostToWrong: number;
  /** Marks forgone by leaving questions blank (potential, not a penalty). */
  marksLeftOnTable: number;
}

// D3 — RRB negative marking: −negRatio per wrong, 0 for skips.
export function scoreMock(answers: ScoredAnswer[], negRatio: number): MockScore {
  let correct = 0;
  let wrong = 0;
  let skipped = 0;

  for (const a of answers) {
    if (a.selectedOption === null) skipped++;
    else if (a.isCorrect) correct++;
    else wrong++;
  }

  const attempted = correct + wrong;
  const marksLostToWrong = wrong * negRatio;
  return {
    score: correct - marksLostToWrong,
    correct,
    wrong,
    skipped,
    attempted,
    accuracy: attempted === 0 ? 0 : correct / attempted,
    marksLostToWrong,
    marksLeftOnTable: skipped,
  };
}

export interface PacingPoint {
  q: number;
  cumulative_ms: number;
}

// D5 — per-question time from cumulative timing; flags the first question
// whose time markedly exceeds the running average (where pace collapses).
export function perQuestionMs(pacing: PacingPoint[]): number[] {
  const sorted = [...pacing].sort((a, b) => a.q - b.q);
  const out: number[] = [];
  let prev = 0;
  for (const p of sorted) {
    out.push(Math.max(0, p.cumulative_ms - prev));
    prev = p.cumulative_ms;
  }
  return out;
}
