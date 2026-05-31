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
// One news item often spans multiple GA topics (e.g. ISRO launch = science +
// defence + achievements), so each card is tagged to its best-fit GA concept
// from the supplied list rather than the whole batch sharing one tag.
export function buildCaCardSystemPrompt(): string {
  return [
    "You write spaced-repetition flashcards from a news item for an RRB NTPC aspirant.",
    "CRITICAL: Use ONLY facts stated in the SOURCE. Do not add outside knowledge.",
    "Each card is one exam-relevant fact: a short front (question/cue) and a short back (answer), both traceable to the SOURCE.",
    "Tag every card with the single best-fit GA concept from the CONCEPTS list — use the exact concept name as written. If no concept fits a fact, omit that card.",
    "Return ONLY a JSON array of objects with keys:",
    '- "front": the cue/question',
    '- "back": the answer',
    '- "concept": the exact concept name from CONCEPTS',
    "Return [] if the SOURCE has no exam-relevant fact. No prose outside the JSON.",
  ].join("\n");
}

export function buildCaCardUserPrompt(input: {
  sourceText: string;
  count: number;
  gaConcepts: string[];
}): string {
  return [
    `Generate up to ${input.count} flashcard(s) from this SOURCE.`,
    "CONCEPTS (pick exactly one per card):",
    input.gaConcepts.map((c) => `- ${c}`).join("\n"),
    "SOURCE:",
    '"""',
    input.sourceText,
    '"""',
  ].join("\n");
}

// C4 (CA-driven) — GA questions from a CA source, each tagged to the GA concept
// it actually tests. Distinct from the passage-driven prompt because that flow
// pre-binds one concept upfront.
export function buildCaGaQuestionSystemPrompt(): string {
  return [
    "You are an item writer for the General Awareness section of India's RRB NTPC exam.",
    "CRITICAL: Use ONLY facts stated in the SOURCE passage. Do not add any fact from your own knowledge.",
    "Every option — correct and distractors — must be checkable against the SOURCE. If the SOURCE lacks enough material, return [].",
    "Exactly one correct option; the other three must be wrong per the SOURCE but plausible.",
    "Tag every question with the single best-fit GA concept from the CONCEPTS list — use the exact concept name. If no concept fits, omit that question.",
    "Return ONLY a JSON array of objects with keys:",
    '- "stem": the question text',
    '- "options": array of exactly 4 distinct answer strings',
    '- "correct_option": integer index 0..3 of the correct option',
    '- "explanation": one or two sentences justifying the answer',
    '- "concept": the exact concept name from CONCEPTS',
    "No prose outside the JSON array.",
  ].join("\n");
}

export function buildCaGaQuestionUserPrompt(input: {
  sourceText: string;
  count: number;
  gaConcepts: string[];
}): string {
  return [
    `Generate up to ${input.count} MCQ(s) grounded entirely in this SOURCE.`,
    "CONCEPTS (pick exactly one per question):",
    input.gaConcepts.map((c) => `- ${c}`).join("\n"),
    "SOURCE:",
    '"""',
    input.sourceText,
    '"""',
  ].join("\n");
}

// Flashcards for a math/reasoning concept: formulas, definitions, rules, method
// steps. Generated freely, then independently fact-checked before they're saved.
export function buildFactCardSystemPrompt(): string {
  return [
    "You write spaced-repetition flashcards for an RRB NTPC aspirant studying a math or reasoning concept.",
    "Each card captures ONE exam-relevant nugget: a formula, definition, rule, or method step. Front = a short cue/question; back = the precise answer.",
    "Use only well-established, universally-correct facts. Keep both sides short and unambiguous — no trick or opinion content.",
    'Return ONLY a JSON array of objects with keys "front" and "back". No prose outside the JSON.',
  ].join("\n");
}

export function buildFactCardUserPrompt(input: {
  conceptName: string;
  topic: string;
  subject: string;
  count: number;
}): string {
  return `Generate ${input.count} flashcard(s) for the concept "${input.conceptName}" (topic: ${input.topic}, subject: ${input.subject}).`;
}

// Flashcards for one concept, grounded strictly in a pasted SOURCE passage (GA —
// Hard Rule §2.1). Every card is re-checked against the SOURCE before saving.
export function buildPassageCardSystemPrompt(): string {
  return [
    "You write spaced-repetition flashcards strictly from a SOURCE passage for an RRB NTPC aspirant.",
    "CRITICAL: Use ONLY facts stated in the SOURCE. Do not add outside knowledge.",
    "Each card is one exam-relevant fact about the concept: a short front (cue/question) and short back (answer), both traceable to the SOURCE.",
    'Return ONLY a JSON array of objects with keys "front" and "back". Return [] if the SOURCE has no exam-relevant fact. No prose outside the JSON.',
  ].join("\n");
}

export function buildPassageCardUserPrompt(input: {
  conceptName: string;
  sourceText: string;
  count: number;
}): string {
  return [
    `Generate up to ${input.count} flashcard(s) about "${input.conceptName}" from this SOURCE.`,
    "SOURCE:",
    '"""',
    input.sourceText,
    '"""',
  ].join("\n");
}

// Scraper split — break a scraped current-affairs page into discrete news items.
// raw_text must be a verbatim substring of the SOURCE so the downstream grounding
// chain (verifyGroundedCards, GA verify gate) keeps working unchanged. The
// category whitelist matches lib/caRanking.ts so caExamProbability resolves
// against a known key (anything else gets the neutral 0.5 prior).
export function buildCaSplitSystemPrompt(): string {
  return [
    "You split a scraped current-affairs page into discrete news items for an RRB NTPC aspirant.",
    "CRITICAL: For each item, raw_text MUST be a verbatim contiguous excerpt copied directly from the SOURCE — no paraphrasing, no rewriting, no combining across distant sections.",
    "Keep each raw_text SHORT: 1-3 sentences, 40-120 words. Pick the sentences that contain the exam-relevant fact(s). Skip URLs, markdown link syntax, citations, and footnotes — choose excerpts that don't contain them.",
    "Return at most 15 items, ranked by exam relevance (most likely to be asked first).",
    "Skip navigation, ads, author bylines, comment sections, and anything that isn't an exam-relevant news fact.",
    "category MUST be one of: appointments, schemes, awards, defence, summits, agreements, sports, economy, science, technology, days, obituaries, books. Use null if none clearly fits.",
    "Return ONLY a JSON array of objects with keys:",
    '- "raw_text": verbatim short excerpt from the SOURCE covering one news item',
    '- "category": one of the allowed categories or null',
    "Return [] if the SOURCE has no exam-relevant news. No prose outside the JSON.",
  ].join("\n");
}

export function buildCaSplitUserPrompt(input: { sourceText: string }): string {
  return [
    "Split this SOURCE into individual news items (max 15, short verbatim excerpts).",
    "SOURCE:",
    '"""',
    input.sourceText,
    '"""',
  ].join("\n");
}

// H3 — a one-line exam-focused digest summary, grounded only in the source.
// Current-affairs FETCH via grounded search (Gemini + Google Search). Unlike the
// SPLIT path (which copies from a page we scraped), this asks the model to gather
// recent exam-relevant news directly through live web search. Each raw_text is
// the fact the model grounds in its search results, and becomes the immutable
// grounding source for downstream GA generation (Hard Rule §2.1). The caller
// enforces that the response actually carried grounding metadata; a model
// answering from memory (no citations) is rejected, never stored.
export function buildCaFetchSystemPrompt(): string {
  return [
    "You gather recent current-affairs items relevant to India's RRB NTPC exam, using web search.",
    "Use the most recent reliable reporting; every fact must come from your search results, never from memory.",
    "Each item must be a self-contained, factually precise blurb (1–3 sentences) suitable for exam GA prep.",
    "Prefer high-yield categories: appointments, awards, sports, schemes, defence, economy, international, science, summits, days.",
    "Return ONLY a JSON array; each element { raw_text, category } where category is a short lowercase tag or null.",
  ].join("\n");
}

export function buildCaFetchUserPrompt(input: { date: string; count: number }): string {
  return [
    `Find up to ${input.count} of the most exam-relevant Indian current-affairs items from around ${input.date} (the last few days).`,
    "Return them as a JSON array of { raw_text, category }. If you find none, return [].",
  ].join("\n");
}

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
