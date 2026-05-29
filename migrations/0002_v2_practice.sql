-- v2 schema: practice bank, attempts, and the student model (BKT).
-- FK-safe order: mock_session (attempt references it) → question → attempt → concept_mastery.
-- Source of truth: CLAUDE.md §5 / RRBNTPCbuildbrief.md §5.

-- A mock test instance. Created here because `attempt` references it; mock
-- features themselves arrive in v3.
CREATE TABLE IF NOT EXISTS mock_session (
    id              BIGSERIAL PRIMARY KEY,
    type            TEXT NOT NULL,                -- full_cbt1 / full_cbt2 / sectional
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ,
    total_questions INT,
    attempted_count INT,
    score           REAL,
    accuracy        REAL,
    time_limit_s    INT,
    pacing_data     JSONB
);

-- MCQs for practice/mocks. source = pyq (ingested) / ai_generated / adversarial.
-- Only verified=true rows are ever shown (Hard Rule §2). PYQs are ingested as verified.
CREATE TABLE IF NOT EXISTS question (
    id                 BIGSERIAL PRIMARY KEY,
    concept_id         BIGINT NOT NULL REFERENCES concept(id),
    stem               TEXT NOT NULL,
    options            JSONB NOT NULL,            -- ["...","...","...","..."]
    correct_option     SMALLINT NOT NULL,         -- index 0..3
    explanation        TEXT,
    difficulty         REAL DEFAULT 0.5,
    source             TEXT NOT NULL CHECK (source IN ('pyq','ai_generated','adversarial')),
    is_adversarial     BOOLEAN DEFAULT FALSE,
    parent_question_id BIGINT REFERENCES question(id),
    exam_year          SMALLINT,
    exam_stage         TEXT,
    gen_source         TEXT,
    verified           BOOLEAN DEFAULT FALSE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_question_concept ON question (concept_id) WHERE verified;

-- EVERY question attempt, right or wrong. APPEND-ONLY (Hard Rule §6).
CREATE TABLE IF NOT EXISTS attempt (
    id              BIGSERIAL PRIMARY KEY,
    question_id     BIGINT NOT NULL REFERENCES question(id),
    concept_id      BIGINT NOT NULL REFERENCES concept(id),  -- denormalized for fast rollups
    mock_session_id BIGINT REFERENCES mock_session(id),
    attempted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    selected_option SMALLINT,                     -- null = skipped
    is_correct      BOOLEAN,
    confidence      SMALLINT CHECK (confidence BETWEEN 1 AND 5),  -- captured BEFORE reveal
    time_taken_ms   INT,
    context         TEXT CHECK (context IN ('mock','practice','feynman','quiz'))
);
CREATE INDEX IF NOT EXISTS idx_attempt_concept ON attempt (concept_id, attempted_at DESC);

-- STUDENT MODEL: live state per concept. One row per concept, updated via BKT.
-- Derived state (the only stateful table that gets UPDATE).
CREATE TABLE IF NOT EXISTS concept_mastery (
    concept_id        BIGINT PRIMARY KEY REFERENCES concept(id),
    attempts          INT DEFAULT 0,
    correct           INT DEFAULT 0,
    wrong             INT DEFAULT 0,
    p_known           REAL DEFAULT 0.1,           -- BKT P(known)
    avg_confidence    REAL,
    calibration_error REAL,                       -- fitted in v5
    mastery_level     TEXT DEFAULT 'new' CHECK (mastery_level IN ('new','learning','review','mastered')),
    last_seen_at      TIMESTAMPTZ,
    last_correct_at   TIMESTAMPTZ
);
