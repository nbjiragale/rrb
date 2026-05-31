// Review intake policy (B3). Domain config, shared by the review queue today
// and the study planner (v3) later — one source of truth, not a UI constant.

/** Max new cards introduced in a single session. */
export const NEW_CARD_CAP = 20;

/** Pause new-card intake when due reviews meet or exceed this backlog. */
export const REVIEW_BACKLOG_THRESHOLD = 80;

/** Planner: max new concepts + due reviews scheduled for a day (I4 intake cap). */
export const DAILY_CAPACITY = 50;

/** Mock fallback time budget per question when exam_config has no section timing. */
export const MOCK_SECONDS_PER_QUESTION = 54;

// LLM output token budgets for generation/verification. A truncated response
// (budget too small, or a reasoning model spending it on thinking) surfaces as a
// JSON-parse or empty-response error, so these are generous and env-tunable.
// max_tokens is only a ceiling — billing is on actual output — so headroom is
// effectively free. Generation calls also disable reasoning at the call site so
// the whole budget goes to the JSON answer.
const GEN_BASE_TOKENS = Number(process.env.LLM_GEN_MAX_TOKENS ?? 4096);
const VERIFY_TOKENS = Number(process.env.LLM_VERIFY_MAX_TOKENS ?? 2048);

/** Output budget for generating `count` items (questions/cards), scaled per item. */
export function genTokens(count = 1, perItem = 400): number {
  return Math.max(GEN_BASE_TOKENS, 1000 + count * perItem);
}

/** Output budget for a verification pass (small JSON, but room for re-solving). */
export function verifyTokens(): number {
  return VERIFY_TOKENS;
}
