// Optional seed: one exam_config + a couple of concepts/cards so the review loop has data.
// Usage: DATABASE_URL=... node --experimental-strip-types scripts/seed.ts
import pg from "pg";
import { EXAM_PATTERN } from "../lib/syllabus.ts";

// `pg` is CommonJS — named imports fail under Node's ESM loader.
const { Client } = pg;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const client = new Client({ connectionString: url });
  await client.connect();

  // RRB NTPC graduate-level CBT-1 structure (A1). The paper is timed as a
  // whole, so per-section time_s is 0 and duration lives with the pattern.
  const cbt1 = EXAM_PATTERN.cbt1;
  await client.query(
    `INSERT INTO exam_config (exam_name, exam_date, negative_mark_ratio, locale, sections)
     SELECT 'RRB NTPC', NULL, $1, 'en', $2::jsonb
     WHERE NOT EXISTS (SELECT 1 FROM exam_config)`,
    [
      cbt1.negative_mark_ratio,
      JSON.stringify(
        cbt1.sections.map((s) => ({ name: s.name, questions: s.questions, marks: s.marks, time_s: 0 }))
      ),
    ]
  );

  // Concept names must stay unique — the ontology seed wires concept_edge by
  // name, so a duplicate would silently point edges at the wrong row.
  const upsertConcept = async (
    name: string,
    subject: string,
    topic: string,
    subtopic: string | null
  ): Promise<number> => {
    const existing = await client.query<{ id: number }>(
      `SELECT id FROM concept WHERE name = $1 AND subject = $2 AND topic = $3`,
      [name, subject, topic]
    );
    if (existing.rows[0]) return existing.rows[0].id;
    const created = await client.query<{ id: number }>(
      `INSERT INTO concept (name, subject, topic, subtopic) VALUES ($1, $2, $3, $4) RETURNING id`,
      [name, subject, topic, subtopic]
    );
    return created.rows[0].id;
  };

  const conceptId = await upsertConcept(
    "President's pardon power (Art. 72)",
    "ga",
    "Indian Polity",
    "Powers of the President"
  );

  await client.query(
    `INSERT INTO card (concept_id, front, back, card_type, state)
     VALUES
       ($1, 'Which article gives the President the power to grant pardons?', 'Article 72.', 'recall', 'new'),
       ($1, 'Which article gives the Governor pardon power?', 'Article 161.', 'recall', 'new')`,
    [conceptId]
  );

  // A verified PYQ so /practice and /tutor have something to work with.
  await client.query(
    `INSERT INTO question (concept_id, stem, options, correct_option, explanation, source, exam_year, exam_stage, verified)
     VALUES ($1, $2, $3::jsonb, $4, $5, 'pyq', 2019, 'cbt1', true)`,
    [
      conceptId,
      "Under which Article can the President of India grant pardons?",
      JSON.stringify(["Article 61", "Article 72", "Article 161", "Article 76"]),
      1,
      "Article 72 grants the President pardon power; Article 161 is the Governor's equivalent.",
    ]
  );

  // A math + reasoning concept with one PYQ each, so a full mock spans sections.
  // Both names match the ontology seed, so whichever runs first wins the row.
  const mathId = await upsertConcept("Percentages", "math", "Arithmetic", null);
  await client.query(
    `INSERT INTO question (concept_id, stem, options, correct_option, explanation, source, exam_year, exam_stage, verified)
     VALUES ($1, $2, $3::jsonb, $4, $5, 'pyq', 2021, 'cbt1', true)`,
    [
      mathId,
      "What is 15% of 240?",
      JSON.stringify(["30", "36", "40", "45"]),
      1,
      "15% of 240 = 0.15 × 240 = 36.",
    ]
  );

  const reasoningId = await upsertConcept("Number Series", "reasoning", "Series", null);
  await client.query(
    `INSERT INTO question (concept_id, stem, options, correct_option, explanation, source, exam_year, exam_stage, verified)
     VALUES ($1, $2, $3::jsonb, $4, $5, 'pyq', 2021, 'cbt1', true)`,
    [
      reasoningId,
      "Find the next term: 2, 6, 12, 20, ?",
      JSON.stringify(["28", "30", "32", "42"]),
      1,
      "Differences are 4, 6, 8, 10 → next is 20 + 10 = 30.",
    ]
  );

  await client.end();
  console.log("seed complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
