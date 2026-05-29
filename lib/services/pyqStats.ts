import { withTransaction } from "@/lib/db/client";

// PYQ analysis (architecture §2): aggregate ingested PYQs per concept/topic into
// pyq_topic_stats, then push the frequency into concept.exam_weight — the signal
// that drives planner priority. Run by the nightly batch (scripts/nightly.ts).
export async function recomputePyqStats(): Promise<{ concepts: number }> {
  return withTransaction(async (tx) => {
    await tx.query(`DELETE FROM pyq_topic_stats`);

    // Recency-weighted frequency: recent years count for more (gentle decay).
    await tx.query(
      `INSERT INTO pyq_topic_stats
         (concept_id, topic, exam_stage, total_appearances, recency_weighted_freq, last_seen_year)
       SELECT q.concept_id,
              c.topic,
              q.exam_stage,
              count(*) AS total_appearances,
              sum(1.0 / (1 + 0.15 * (extract(year from now())::int
                    - coalesce(q.exam_year, extract(year from now())::int)))) AS recency_weighted_freq,
              max(q.exam_year) AS last_seen_year
       FROM question q
       JOIN concept c ON c.id = q.concept_id
       WHERE q.source = 'pyq'
       GROUP BY q.concept_id, c.topic, q.exam_stage`
    );

    // exam_weight = appearance count (floored at the 1.0 default for fairness
    // against concepts with no PYQs yet).
    const res = await tx.query(
      `UPDATE concept
         SET exam_weight = greatest(1.0, sub.total)
       FROM (
         SELECT concept_id, count(*)::real AS total
         FROM question WHERE source = 'pyq'
         GROUP BY concept_id
       ) sub
       WHERE concept.id = sub.concept_id`
    );

    return { concepts: res.rowCount ?? 0 };
  });
}
