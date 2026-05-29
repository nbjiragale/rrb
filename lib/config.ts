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
