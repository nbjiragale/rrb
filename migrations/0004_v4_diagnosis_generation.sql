-- v4 schema: misconception diagnosis, grounded generation, current affairs.
-- New tables: current_affairs_item, misconception, misconception_hit.
-- FK-safe order: current_affairs_item (independent) → misconception (refs concept)
-- → misconception_hit (refs attempt + misconception).
-- Source of truth: CLAUDE.md §5 / RRBNTPCbuildbrief.md §5.

-- Ingested current affairs → the ONLY grounding source for GA generation
-- (Hard Rule §2.1). raw_text is sacred: never generate a GA fact without it.
CREATE TABLE IF NOT EXISTS current_affairs_item (
    id               BIGSERIAL PRIMARY KEY,
    ca_date          DATE NOT NULL,
    source_url       TEXT,
    raw_text         TEXT NOT NULL,               -- the grounding source
    summary          TEXT,
    category         TEXT,                        -- appointments / awards / sports / schemes / ...
    exam_probability REAL,                        -- ranked in v5
    processed_at     TIMESTAMPTZ                  -- set once cards/questions are built from it
);
CREATE INDEX IF NOT EXISTS idx_ca_date ON current_affairs_item (ca_date DESC);

-- DIAGNOSIS: catalog of failure modes, scoped to a concept. Two-level structure
-- (CLAUDE.md §7): specific `label` lets the tutor name the exact trap; general
-- `kind` lets the dashboard aggregate. (concept_id, label) is unique so a
-- repeated mistake increments a count rather than spawning duplicates.
CREATE TABLE IF NOT EXISTS misconception (
    id          BIGSERIAL PRIMARY KEY,
    concept_id  BIGINT NOT NULL REFERENCES concept(id),
    label       TEXT NOT NULL,                   -- "confuses_president_governor_pardon"
    description TEXT NOT NULL,
    kind        TEXT NOT NULL CHECK (kind IN (
                    'confusion','factual_gap','partial_rule',
                    'computational','conceptual','trap','stale')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (concept_id, label)
);

-- Links a wrong attempt to its diagnosed misconception(s). AI interprets, code
-- stores (architecture §9 step 2). attempt rows stay append-only; this is the
-- derived diagnosis layer on top of them.
CREATE TABLE IF NOT EXISTS misconception_hit (
    id               BIGSERIAL PRIMARY KEY,
    attempt_id       BIGINT NOT NULL REFERENCES attempt(id),
    misconception_id BIGINT NOT NULL REFERENCES misconception(id),
    ai_confidence    REAL,
    ai_rationale     TEXT,
    diagnosed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mhit_attempt ON misconception_hit (attempt_id);
CREATE INDEX IF NOT EXISTS idx_mhit_misconception ON misconception_hit (misconception_id);

-- C6 — flag a bad generated question. Flagging sets verified=false (so existing
-- "WHERE verified" serve queries exclude it automatically), and records when/why
-- so it can be queued for review/regeneration. flagged_at distinguishes a
-- user-flagged item from one the verify gate never passed.
ALTER TABLE question ADD COLUMN IF NOT EXISTS flagged_at  TIMESTAMPTZ;
ALTER TABLE question ADD COLUMN IF NOT EXISTS flag_reason TEXT;
