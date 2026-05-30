// H4 — likelihood a current-affairs item is asked in RRB NTPC GA. Category-based
// priors keep this deterministic and free (no LLM): the categories that recur in
// past papers score higher. Pure — unit-tested.

const CATEGORY_PRIOR: Record<string, number> = {
  appointments: 0.85,
  schemes: 0.85,
  awards: 0.8,
  defence: 0.75,
  summits: 0.7,
  agreements: 0.7,
  sports: 0.65,
  economy: 0.65,
  science: 0.6,
  technology: 0.6,
  days: 0.55,
  obituaries: 0.5,
  books: 0.45,
};

const DEFAULT_PRIOR = 0.5;

export function caExamProbability(category: string | null | undefined): number {
  if (!category) return DEFAULT_PRIOR;
  return CATEGORY_PRIOR[category.trim().toLowerCase()] ?? DEFAULT_PRIOR;
}
