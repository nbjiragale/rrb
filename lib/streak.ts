// Streak / consistency (J4) — pure, no I/O. A "study day" is any day with at
// least one review. Gentle by design: a missed day ends the current streak but
// nothing is penalised, and today-not-yet-studied does NOT break a streak that
// ran through yesterday.

export interface StreakResult {
  current: number;
  longest: number;
  /** True if the most recent study day is today (the streak is "live"). */
  studiedToday: boolean;
}

// `days` — distinct study dates as 'YYYY-MM-DD'. `todayIso` lets callers/tests
// pin "today" deterministically.
export function computeStreak(days: string[], todayIso: string): StreakResult {
  const unique = [...new Set(days)].sort(); // ascending ISO dates sort lexicographically
  if (unique.length === 0) return { current: 0, longest: 0, studiedToday: false };

  // Longest run of consecutive calendar days anywhere in the history.
  let longest = 1;
  let run = 1;
  for (let i = 1; i < unique.length; i++) {
    run = dayDiff(unique[i - 1], unique[i]) === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  // Current streak: walk back from the most recent study day, but only counts
  // as "current" if that day is today or yesterday (today simply not done yet).
  const last = unique[unique.length - 1];
  const gapFromToday = dayDiff(last, todayIso);
  let current = 0;
  if (gapFromToday <= 1) {
    current = 1;
    for (let i = unique.length - 1; i > 0; i--) {
      if (dayDiff(unique[i - 1], unique[i]) === 1) current++;
      else break;
    }
  }

  return { current, longest, studiedToday: gapFromToday === 0 };
}

// Whole-day difference b − a (both 'YYYY-MM-DD'), via UTC midnight to dodge DST.
function dayDiff(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}
