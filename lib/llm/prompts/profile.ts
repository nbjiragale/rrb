import type { LearnerProfileFocus } from "@/lib/db/types";

// Nightly profile (J3): the model compresses the latest counts into one warm,
// concrete paragraph the tutor reads on every call. Pure prompt construction.

export interface ProfileInputs {
  masteredCount: number;
  trackedCount: number;
  totalAttempts: number;
  dueReviews: number;
  weakConcepts: string[];
  recurringMisconceptions: string[];
  daysToExam: number | null;
  calibration: string | null;
}

export function buildProfileSystemPrompt(): string {
  return [
    "You write a single concise paragraph (4-6 sentences) describing an RRB NTPC learner for use as tutor context.",
    "Be specific and factual using ONLY the stats provided — name weak areas and recurring traps; note over/under-confidence if given.",
    "Neutral, supportive tone. No headings, no lists, no invented facts. Output the paragraph only.",
  ].join("\n");
}

export function buildProfileUserPrompt(i: ProfileInputs): string {
  const lines = [
    `Concepts tracked: ${i.trackedCount}; mastered: ${i.masteredCount}; total attempts: ${i.totalAttempts}.`,
    `Reviews due now: ${i.dueReviews}.`,
    i.weakConcepts.length ? `Weakest concepts: ${i.weakConcepts.join(", ")}.` : "No weak concepts logged yet.",
    i.recurringMisconceptions.length
      ? `Recurring misconceptions: ${i.recurringMisconceptions.join("; ")}.`
      : "No recurring misconceptions yet.",
    i.calibration ? `Calibration: ${i.calibration}.` : "",
    i.daysToExam != null ? `Days to exam: ${i.daysToExam}.` : "",
    "Write the profile paragraph.",
  ];
  return lines.filter(Boolean).join("\n");
}

export function buildFocusAreas(i: ProfileInputs): LearnerProfileFocus {
  return {
    weak_concepts: i.weakConcepts,
    recurring_misconceptions: i.recurringMisconceptions,
    due_reviews: i.dueReviews,
  };
}
