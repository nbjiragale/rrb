-- Fix avg_confidence's running average (CLAUDE.md §7 student model). The
-- per-attempt average was divided by total `attempts`, but many attempts carry
-- no confidence (every mock answer, any graded skip), so the denominator was
-- inflated and the stored average skewed. Track the count of confidence-bearing
-- attempts explicitly — like the existing attempts/correct/wrong counters — and
-- backfill from the append-only attempt log, which also repairs historical rows.

ALTER TABLE concept_mastery
    ADD COLUMN IF NOT EXISTS confidence_count INT NOT NULL DEFAULT 0;

UPDATE concept_mastery m
   SET avg_confidence = s.avg_conf,
       confidence_count = s.n
  FROM (
    SELECT concept_id,
           avg(confidence)::real AS avg_conf,
           count(*)              AS n
      FROM attempt
     WHERE confidence IS NOT NULL AND is_correct IS NOT NULL
     GROUP BY concept_id
  ) s
 WHERE m.concept_id = s.concept_id;
