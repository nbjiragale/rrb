-- v3 schema: knowledge graph, PYQ analysis, and the study planner.
-- mock_session already exists (created in 0002 for attempt's FK).
-- Source of truth: CLAUDE.md §5 / RRBNTPCbuildbrief.md §5.

-- KNOWLEDGE GRAPH. 'prerequisite' drives planner order; 'contrasts_with' (v6)
-- links the pairs the learner confuses.
CREATE TABLE IF NOT EXISTS concept_edge (
    source_id     BIGINT NOT NULL REFERENCES concept(id),
    target_id     BIGINT NOT NULL REFERENCES concept(id),
    relation_type TEXT NOT NULL CHECK (relation_type IN ('prerequisite','related','contrasts_with')),
    weight        REAL DEFAULT 1.0,
    PRIMARY KEY (source_id, target_id, relation_type)
);
CREATE INDEX IF NOT EXISTS idx_edge_source ON concept_edge (source_id);

-- PYQ ANALYSIS OUTPUT: per-topic frequency across past papers → drives
-- exam_weight + the planner. Recomputed by the nightly batch.
CREATE TABLE IF NOT EXISTS pyq_topic_stats (
    id                    BIGSERIAL PRIMARY KEY,
    concept_id            BIGINT REFERENCES concept(id),
    topic                 TEXT NOT NULL,
    exam_stage            TEXT,
    total_appearances     INT DEFAULT 0,
    recency_weighted_freq REAL,
    last_seen_year        SMALLINT,
    computed_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PLANNER OUTPUT: what to learn next + when. One row per day/week.
CREATE TABLE IF NOT EXISTS study_plan (
    id            BIGSERIAL PRIMARY KEY,
    plan_date     DATE NOT NULL,
    horizon       TEXT CHECK (horizon IN ('day','week')),
    new_concepts  JSONB NOT NULL,                 -- ordered [{concept_id, order, priority, reason}]
    review_load   INT,
    capacity_note TEXT,
    generated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_study_plan_date ON study_plan (plan_date DESC);
