-- v1 schema: the daily review loop foundation.
-- Tables: exam_config, concept, card, review. FK-safe creation order.
-- Source of truth: CLAUDE.md §5 / RRBNTPCbuildbrief.md §5.

CREATE EXTENSION IF NOT EXISTS vector;  -- pgvector; embedding dim 1024

-- Exam parameterisation. One row per instance. Read by mocks/EV/planner (later phases).
CREATE TABLE IF NOT EXISTS exam_config (
    id                  BIGSERIAL PRIMARY KEY,
    exam_name           TEXT NOT NULL,
    exam_date           DATE,
    negative_mark_ratio REAL DEFAULT 0.3333,
    locale              TEXT DEFAULT 'en',
    sections            JSONB NOT NULL,            -- [{name, questions, marks, time_s}, ...]
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ONTOLOGY: every testable unit. Hierarchical subject > topic > subtopic > concept.
CREATE TABLE IF NOT EXISTS concept (
    id           BIGSERIAL PRIMARY KEY,
    name         TEXT NOT NULL,
    subject      TEXT NOT NULL CHECK (subject IN ('math','reasoning','ga')),
    topic        TEXT NOT NULL,
    subtopic     TEXT,
    parent_id    BIGINT REFERENCES concept(id),
    description  TEXT,
    exam_weight  REAL DEFAULT 1.0,
    embedding    vector(1024),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_concept_subject ON concept (subject, topic);
CREATE INDEX IF NOT EXISTS idx_concept_embed   ON concept USING hnsw (embedding vector_cosine_ops);

-- SRS review unit. Many cards per concept. FSRS state lives here.
CREATE TABLE IF NOT EXISTS card (
    id            BIGSERIAL PRIMARY KEY,
    concept_id    BIGINT NOT NULL REFERENCES concept(id),
    front         TEXT NOT NULL,
    back          TEXT NOT NULL,
    card_type     TEXT NOT NULL CHECK (card_type IN ('recall','cloze','mcq')),
    source_ref    TEXT,
    stability     REAL,
    difficulty    REAL,
    state         TEXT DEFAULT 'new' CHECK (state IN ('new','learning','review','relearning')),
    due_at        TIMESTAMPTZ,
    last_review   TIMESTAMPTZ,
    reps          INT DEFAULT 0,
    lapses        INT DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_card_due ON card (due_at) WHERE state <> 'new';

-- Each SRS review event (drives FSRS). APPEND-ONLY — never overwrite history.
CREATE TABLE IF NOT EXISTS review (
    id             BIGSERIAL PRIMARY KEY,
    card_id        BIGINT NOT NULL REFERENCES card(id),
    reviewed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    rating         SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 4),  -- again/hard/good/easy
    response_ms    INT,
    prev_stability REAL,
    new_stability  REAL,
    new_due_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_review_card ON review (card_id, reviewed_at DESC);
