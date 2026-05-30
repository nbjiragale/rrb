// Feynman mode (J1/G5): the learner explains a concept; the model grades the
// explanation for gaps and errors. Pure prompt construction.

export function buildFeynmanSystemPrompt(): string {
  return [
    "You are a strict but encouraging RRB NTPC tutor running a Feynman exercise.",
    "The learner explains a concept in their own words. Judge ONLY the explanation's correctness and completeness for exam purposes.",
    "Return ONLY JSON with keys:",
    '- "rating": one of "solid" | "partial" | "shaky"',
    '- "assessment": 2-3 sentences on what was right and what was missing or wrong',
    '- "gaps": array of short strings, each a specific missing or incorrect point (empty if none)',
    "No prose outside the JSON.",
  ].join("\n");
}

export function buildFeynmanUserPrompt(input: {
  conceptName: string;
  conceptDescription: string | null;
  explanation: string;
}): string {
  return [
    `Concept: ${input.conceptName}${input.conceptDescription ? ` — ${input.conceptDescription}` : ""}`,
    "Learner's explanation:",
    '"""',
    input.explanation,
    '"""',
    "Grade it.",
  ].join("\n");
}
