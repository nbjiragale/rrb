-- v5 schema: semantic memory, the learner profile, and confidence calibration.
-- New tables: interaction, learner_profile, calibration_model.
-- FK-safe order: all reference only concept (already present).
-- Source of truth: CLAUDE.md §5 / RRBNTPCbuildbrief.md §5.

-- SEMANTIC MEMORY: free text (Feynman explanations, doubts, notes) for fuzzy
-- recall via pgvector cosine search (architecture §8 / walkthrough B). APPEND-ONLY.
-- NOTE: the brief lists `embedding ... NOT NULL`; we make it nullable on purpose
-- so text can be stored immediately and embedded later by the nightly batch
-- (walkthrough C.5), and so Feynman/doubt capture still works when no embedding
-- provider is configured. Rows without an embedding are simply skipped by search.
CREATE TABLE IF NOT EXISTS interaction (
    id           BIGSERIAL PRIMARY KEY,
    type         TEXT NOT NULL CHECK (type IN ('feynman','doubt','note')),
    concept_id   BIGINT REFERENCES concept(id),
    content      TEXT NOT NULL,                   -- what the learner said
    ai_feedback  TEXT,                            -- grading / response (nullable)
    embedding    vector(1024),                    -- of content; backfilled if absent
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_interaction_embed ON interaction USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_interaction_concept ON interaction (concept_id, created_at DESC);

-- THE PROFILE: one-paragraph learner summary, regenerated nightly, injected into
-- every tutor prompt (cached). focus_areas/snapshot keep it auditable.
CREATE TABLE IF NOT EXISTS learner_profile (
    id           BIGSERIAL PRIMARY KEY,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    summary_text TEXT NOT NULL,
    focus_areas  JSONB,                           -- structured: weak concepts, upcoming reviews
    snapshot     JSONB                            -- counts the paragraph was based on
);

-- CONFIDENCE CALIBRATION: maps self-reported confidence (1–5) → real accuracy,
-- fitted nightly by logistic regression. ev_threshold = confidence above which
-- attempting is +EV under the exam's negative marking.
CREATE TABLE IF NOT EXISTS calibration_model (
    id              BIGSERIAL PRIMARY KEY,
    fitted_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    coef_intercept  REAL,
    coef_confidence REAL,
    n_samples       INT,
    brier_score     REAL,
    ev_threshold    REAL
);

-- H4 — likelihood a current-affairs item is asked; drives digest ordering.
-- Column already created in 0004; ensured here for clarity (no-op if present).
ALTER TABLE current_affairs_item ADD COLUMN IF NOT EXISTS exam_probability REAL;
