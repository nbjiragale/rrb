-- v6 schema: external learning resources + mastery history for trends.
-- concept_edge already exists (0003). Source of truth: CLAUDE.md §5 / RRBNTPCbuildbrief.md §5.

-- A4 — "WHERE to learn" pointers. The app ROUTES out to external content; it
-- never stores lessons (Hard Rule §5: no third-party content persisted).
CREATE TABLE IF NOT EXISTS concept_resource (
    id          BIGSERIAL PRIMARY KEY,
    concept_id  BIGINT NOT NULL REFERENCES concept(id),
    kind        TEXT CHECK (kind IN ('book','video','article','notes')),
    label       TEXT NOT NULL,                   -- "NCERT Class 9 History, Ch. 2"
    url         TEXT,
    priority    SMALLINT DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_resource_concept ON concept_resource (concept_id, priority);

-- J2 — append-only daily mastery history. concept_mastery holds only current
-- state (UPDATE-only), so trends need their own log. This is DERIVED state, but
-- one row per (concept, day): the PK makes the nightly write idempotent (a
-- same-day re-run overwrites that day, the one update derived state is allowed).
-- Backfilled retroactively from the append-only attempt log on first run, so
-- trends aren't empty on day one (raw attempt rows are never touched).
CREATE TABLE IF NOT EXISTS concept_mastery_snapshot (
    concept_id    BIGINT NOT NULL REFERENCES concept(id),
    snapshot_date DATE NOT NULL,
    p_known       REAL NOT NULL,
    mastery_level TEXT NOT NULL CHECK (mastery_level IN ('new','learning','review','mastered')),
    PRIMARY KEY (concept_id, snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_snapshot_date ON concept_mastery_snapshot (snapshot_date);
