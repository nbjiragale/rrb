// Pure prompts for the INDEPENDENT verification pass (§10). The verifier never
// sees the generator's claimed answer — it solves/checks from scratch, and the
// gate (lib/llm/verify.ts) compares the two.

// Math/reasoning: re-solve and report the index the verifier believes correct.
export function buildSolveSystemPrompt(): string {
  return [
    "You are a meticulous solver. Solve the MCQ independently by exact reasoning.",
    "Return ONLY JSON:",
    '- "correct_option": integer index 0..3 you computed',
    '- "unique": true if exactly one option is correct, false otherwise',
    '- "solvable": true if the question is well-posed and answerable, false otherwise',
    "No prose outside the JSON.",
  ].join("\n");
}

export function buildSolveUserPrompt(stem: string, options: string[]): string {
  return [
    `Question: ${stem}`,
    `Options: ${options.map((o, i) => `${i}. ${o}`).join(" | ")}`,
    "Solve it.",
  ].join("\n");
}

// GA: confirm every option traces to the source, and identify the correct one
// using ONLY the source.
export function buildGroundSystemPrompt(): string {
  return [
    "You verify that an MCQ is fully grounded in a SOURCE passage.",
    "Using ONLY the SOURCE (ignore any outside knowledge), return ONLY JSON:",
    '- "all_grounded": true only if EVERY option is checkable against the SOURCE (the correct one true, distractors verifiably wrong per the SOURCE)',
    '- "correct_option": integer index 0..3 the SOURCE supports as correct, or -1 if undeterminable',
    "No prose outside the JSON.",
  ].join("\n");
}

export function buildGroundUserPrompt(stem: string, options: string[], sourceText: string): string {
  return [
    `Question: ${stem}`,
    `Options: ${options.map((o, i) => `${i}. ${o}`).join(" | ")}`,
    "SOURCE:",
    '"""',
    sourceText,
    '"""',
  ].join("\n");
}

// H2 — confirm each generated flashcard's fact traces to the source (one batched
// call). Returns a grounded flag per card, in order.
export function buildCardGroundSystemPrompt(): string {
  return [
    "You verify that flashcards contain ONLY facts present in a SOURCE passage.",
    "Using ONLY the SOURCE (ignore outside knowledge), for each numbered card decide if BOTH its front and back are supported by the SOURCE.",
    'Return ONLY JSON: { "grounded": [boolean, ...] } with one entry per card, in order.',
    "No prose outside the JSON.",
  ].join("\n");
}

export function buildCardGroundUserPrompt(
  cards: { front: string; back: string }[],
  sourceText: string
): string {
  return [
    "Cards:",
    ...cards.map((c, i) => `${i}. FRONT: ${c.front} | BACK: ${c.back}`),
    "SOURCE:",
    '"""',
    sourceText,
    '"""',
  ].join("\n");
}
