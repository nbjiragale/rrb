-- Testbook mock-result import (external integration).
-- A Testbook test is human-authored, pre-vetted exam-prep content — the same
-- trust level as a PYQ — so imported questions are stored verified=true and
-- bypass the LLM verify gate (Hard Rule §2 governs AI-*generated* content only).
-- Personal single-user use of one's own subscription data (Hard Rule §5).

-- New question source for externally-imported items.
ALTER TABLE question DROP CONSTRAINT IF EXISTS question_source_check;
ALTER TABLE question
  ADD CONSTRAINT question_source_check
  CHECK (source IN ('pyq','ai_generated','adversarial','testbook'));

-- Stable provider key (e.g. 'testbook:<questionId>') for idempotent re-imports
-- and to join an attempt back to its source item. Partial-unique so only
-- external rows are constrained; native rows keep external_ref NULL.
ALTER TABLE question ADD COLUMN IF NOT EXISTS external_ref TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_question_external_ref
  ON question (external_ref) WHERE external_ref IS NOT NULL;

-- Same idempotency key on the session: re-importing a mock updates nothing twice.
ALTER TABLE mock_session ADD COLUMN IF NOT EXISTS external_ref TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_mock_session_external_ref
  ON mock_session (external_ref) WHERE external_ref IS NOT NULL;

-- Manual overrides for the tag→concept resolver. Testbook's topic tags don't
-- always match a concept name/topic verbatim; rather than silently mis-attribute
-- (which would poison BKT), unmatched tags are surfaced and mapped here once.
CREATE TABLE IF NOT EXISTS testbook_tag_map (
    tag        TEXT PRIMARY KEY,
    concept_id BIGINT NOT NULL REFERENCES concept(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
