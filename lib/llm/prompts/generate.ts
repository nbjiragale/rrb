// Pure prompt construction for question/card generation (§10). Generation is
// always followed by the verify gate (lib/llm/verify.ts) — these prompts ask for
// quality, the gate enforces it.

const JSON_QUESTION_SHAPE = [
  "Return ONLY a JSON array of question objects, each with keys:",
  '- "stem": the question text',
  '- "options": array of exactly 4 distinct answer strings',
  '- "correct_option": integer index 0..3 of the correct option',
  '- "explanation": one or two sentences justifying the answer',
  "No prose outside the JSON array.",
].join("\n");

// C3 — fresh math/reasoning. The model may use its own knowledge here (unlike
// GA); the verify gate independently re-solves to confirm the answer.
export function buildMathSystemPrompt(): string {
  return [
    "You are an item writer for India's RRB NTPC quantitative aptitude and reasoning sections.",
    "Write self-contained MCQs solvable by exact computation — no ambiguity, exactly one correct option.",
    "Distractors must be plausible (reflect common errors), all four options distinct.",
    JSON_QUESTION_SHAPE,
  ].join("\n");
}

export function buildMathUserPrompt(input: {
  conceptName: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  count: number;
}): string {
  return [
    `Concept: ${input.conceptName} (topic: ${input.topic}).`,
    `Generate ${input.count} ${input.difficulty}-difficulty MCQ(s) on exactly this concept.`,
  ].join("\n");
}

// C4 — GA strictly from source text (Hard Rule §2.1). Every fact must trace to
// the passage; the verify gate re-checks grounding against the same source.
export function buildGaSystemPrompt(): string {
  return [
    "You are an item writer for the General Awareness section of India's RRB NTPC exam.",
    "CRITICAL: Use ONLY facts stated in the SOURCE passage below. Do not add any fact from your own knowledge.",
    "Every option — correct and distractors — must be checkable against the SOURCE. If the SOURCE lacks enough material, return an empty array [].",
    "Exactly one correct option; the other three must be wrong per the SOURCE but plausible.",
    JSON_QUESTION_SHAPE,
  ].join("\n");
}

export function buildGaUserPrompt(input: {
  conceptName: string;
  sourceText: string;
  count: number;
}): string {
  return [
    `Concept tag: ${input.conceptName}.`,
    `Generate up to ${input.count} MCQ(s) grounded entirely in this SOURCE.`,
    "SOURCE:",
    '"""',
    input.sourceText,
    '"""',
  ].join("\n");
}

// C5 — adversarial variant that forces the exact distinction the learner missed.
export function buildAdversarialSystemPrompt(): string {
  return [
    "You are an item writer creating a targeted variant to fix one specific learner mistake.",
    "Write ONE new MCQ on the same concept that forces the learner to apply the exact distinction they got wrong.",
    "It must be a genuinely different item (new numbers/framing), not a reword. Exactly one correct option, four distinct plausible options.",
    JSON_QUESTION_SHAPE,
  ].join("\n");
}

export function buildAdversarialUserPrompt(input: {
  conceptName: string;
  stem: string;
  options: string[];
  correctText: string;
  selectedText: string | null;
  misconceptionLabel: string;
  misconceptionDescription: string;
}): string {
  const chose = input.selectedText ? `chose "${input.selectedText}"` : "left it blank";
  return [
    `Concept: ${input.conceptName}.`,
    `Original question: ${input.stem}`,
    `Correct answer was "${input.correctText}"; the learner ${chose}.`,
    `Diagnosed misconception: ${input.misconceptionLabel} — ${input.misconceptionDescription}.`,
    "Write 1 variant that directly targets this misconception.",
  ].join("\n");
}

// H2 — SRS cards built only from a current-affairs source (grounded like GA).
export function buildCaCardSystemPrompt(): string {
  return [
    "You write spaced-repetition flashcards from a news item for an RRB NTPC aspirant.",
    "CRITICAL: Use ONLY facts stated in the SOURCE. Do not add outside knowledge.",
    "Each card is one exam-relevant fact: a short front (question/cue) and a short back (answer), both traceable to the SOURCE.",
    "Return ONLY a JSON array of objects with keys:",
    '- "front": the cue/question',
    '- "back": the answer',
    "Return [] if the SOURCE has no exam-relevant fact. No prose outside the JSON.",
  ].join("\n");
}

export function buildCaCardUserPrompt(input: { sourceText: string; count: number }): string {
  return [
    `Generate up to ${input.count} flashcard(s) from this SOURCE.`,
    "SOURCE:",
    '"""',
    input.sourceText,
    '"""',
  ].join("\n");
}

// H3 — a one-line exam-focused digest summary, grounded only in the source.
export function buildCaSummarySystemPrompt(): string {
  return [
    "You summarise a news item for an RRB NTPC aspirant's daily revision digest.",
    "Write ONE crisp sentence capturing the exam-relevant fact(s), using ONLY the SOURCE.",
    "No preamble, no outside facts. Output the sentence only.",
  ].join("\n");
}

export function buildCaSummaryUserPrompt(sourceText: string): string {
  return ["SOURCE:", '"""', sourceText, '"""', "Summarise it in one sentence."].join("\n");
}
