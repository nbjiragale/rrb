// Study planner — pure scheduling logic, no I/O (CLAUDE.md §7). The service
// layer gathers inputs from the DB and persists the result.

import type { PlannedConcept } from "@/lib/db/types";

export interface PlannerConcept {
  id: number;
  examWeight: number;
  pKnown: number;
  prerequisiteIds: number[];
}

export interface PlanInput {
  concepts: PlannerConcept[];
  /** Cards due this period (FSRS). */
  reviewLoad: number;
  /** Max new concepts + due reviews for the period. */
  dailyCapacity: number;
  /** I3 — energy-aware: reviews only. */
  lowEnergy: boolean;
  /** I5 — exam-date backstop. null when no exam date configured. */
  daysToExam: number | null;
}

export interface Plan {
  newConcepts: PlannedConcept[];
  reviewLoad: number;
  capacityNote: string;
}

// Thresholds (CLAUDE.md §7): a prerequisite is "owned" at ≥0.7; a concept is
// learnable while its own p_known < 0.6.
const PREREQ_OWNED = 0.7;
const OWN_NOT_LEARNED = 0.6;
/** Within this many days of the exam, stop new intake (review + mocks only). */
const EXAM_BACKSTOP_DAYS = 21;

export function buildPlan(input: PlanInput): Plan {
  const reviewsOnly = (note: string): Plan => ({
    newConcepts: [],
    reviewLoad: input.reviewLoad,
    capacityNote: note,
  });

  if (input.lowEnergy) return reviewsOnly("Low-energy day → reviews only.");

  if (input.daysToExam !== null && input.daysToExam <= EXAM_BACKSTOP_DAYS) {
    return reviewsOnly(`Exam in ${input.daysToExam}d → review + mocks only; no new intake.`);
  }

  // I2 — learnable: prerequisites owned, this concept not yet owned.
  const learnable = input.concepts.filter(
    (c) =>
      c.pKnown < OWN_NOT_LEARNED &&
      c.prerequisiteIds.every((pid) => pKnownOf(input.concepts, pid) >= PREREQ_OWNED)
  );

  // PRIORITY(c) = exam_weight × (1 − p_known): high-yield, weak topics first.
  const ranked = learnable
    .map((c) => ({ c, priority: c.examWeight * (1 - c.pKnown) }))
    .sort((a, b) => b.priority - a.priority);

  // I4 — intake cap: new concepts must fit alongside reviews within capacity.
  const slots = Math.max(0, input.dailyCapacity - input.reviewLoad);
  const chosen = ranked.slice(0, slots);

  const newConcepts: PlannedConcept[] = chosen.map((x, i) => ({
    concept_id: x.c.id,
    order: i + 1,
    priority: round2(x.priority),
    reason: `High-yield (weight ${round2(x.c.examWeight)}) and weak (p_known ${round2(x.c.pKnown)}).`,
  }));

  const capacityNote =
    slots === 0
      ? `Reviews (${input.reviewLoad}) fill today's capacity → no new concepts.`
      : `${newConcepts.length} new concept(s) alongside ${input.reviewLoad} reviews.`;

  return { newConcepts, reviewLoad: input.reviewLoad, capacityNote };
}

function pKnownOf(concepts: PlannerConcept[], id: number): number {
  return concepts.find((c) => c.id === id)?.pKnown ?? 0.1;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
