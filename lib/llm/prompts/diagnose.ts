import type { AttemptForDiagnosis } from "@/lib/db/queries/attempts";

// Pure prompt construction for misconception diagnosis (architecture §9 step 2).
// `stale` is excluded here — code detects memory decay deterministically (F4)
// before this call, so the model only chooses among genuine error modes.

const KIND_REFERENCE = [
  "confusion: mixes two similar concepts",
  "factual_gap: simply doesn't know the fact",
  "partial_rule: knows the rule, misses an edge case",
  "computational: right method, arithmetic slip",
  "conceptual: wrong underlying mental model",
  "trap: fell for a distractor / misread the question",
].join("\n");

export function buildDiagnoseSystemPrompt(): string {
  return [
    "You are an expert exam diagnostician for India's RRB NTPC exam.",
    "Given one wrong answer, classify the single most likely underlying mistake.",
    "Choose exactly one `kind` from this taxonomy:",
    KIND_REFERENCE,
    "",
    "Return ONLY a JSON object with keys:",
    '- "kind": one of the six values above',
    '- "label": a short reusable snake_case slug for this specific mistake (e.g. "confuses_72_161_pardon"); stable so the same trap reuses it',
    '- "description": one plain sentence naming the specific confusion or gap',
    '- "rationale": one sentence on why this answer points to that mistake',
    '- "confidence": a number 0..1',
    "No prose outside the JSON.",
  ].join("\n");
}

export function buildDiagnoseUserPrompt(a: AttemptForDiagnosis): string {
  const chose = a.selected_text !== null ? `chose "${a.selected_text}"` : "left it blank";
  return [
    `Concept: ${a.concept_name} (${a.subject})`,
    `Question: ${a.stem}`,
    `Options: ${a.options.map((o, i) => `${i + 1}. ${o}`).join(" | ")}`,
    `Correct answer: "${a.correct_text}"`,
    `Learner ${chose}.`,
    a.confidence !== null ? `Learner's confidence was ${a.confidence}/5.` : "",
    "Classify the mistake.",
  ]
    .filter(Boolean)
    .join("\n");
}
