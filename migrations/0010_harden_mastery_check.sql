-- Hardening: make the BKT invariant structural, not just convention.
-- concept_mastery.p_known is a probability fed back into the next BKT update;
-- an out-of-range value compounds and silently corrupts mastery. lib/bkt.ts now
-- clamps every result into (0,1); this CHECK is the matching DB guard so no code
-- path (import, backfill, manual fix) can ever persist an invalid probability.
ALTER TABLE concept_mastery
  ADD CONSTRAINT chk_p_known_range CHECK (p_known > 0 AND p_known < 1) NOT VALID;

-- Validate against existing rows separately so the migration still applies if a
-- legacy out-of-range value exists (surface it rather than silently skipping).
ALTER TABLE concept_mastery VALIDATE CONSTRAINT chk_p_known_range;
