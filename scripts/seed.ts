// Optional seed: one exam_config + a couple of concepts/cards so the review loop has data.
// Usage: DATABASE_URL=... node --experimental-strip-types scripts/seed.ts
import { Client } from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const client = new Client({ connectionString: url });
  await client.connect();

  // RRB NTPC CBT-1 structure (A1).
  await client.query(
    `INSERT INTO exam_config (exam_name, exam_date, negative_mark_ratio, locale, sections)
     SELECT 'RRB NTPC', NULL, 0.3333, 'en', $1::jsonb
     WHERE NOT EXISTS (SELECT 1 FROM exam_config)`,
    [
      JSON.stringify([
        { name: "Mathematics", questions: 30, marks: 30, time_s: 0 },
        { name: "General Intelligence & Reasoning", questions: 30, marks: 30, time_s: 0 },
        { name: "General Awareness", questions: 40, marks: 40, time_s: 0 },
      ]),
    ]
  );

  const polity = await client.query(
    `INSERT INTO concept (name, subject, topic, subtopic)
     VALUES ('President''s pardon power (Art. 72)', 'ga', 'Indian Polity', 'Powers of the President')
     RETURNING id`
  );
  const conceptId = polity.rows[0].id;

  await client.query(
    `INSERT INTO card (concept_id, front, back, card_type, state)
     VALUES
       ($1, 'Which article gives the President the power to grant pardons?', 'Article 72.', 'recall', 'new'),
       ($1, 'Which article gives the Governor pardon power?', 'Article 161.', 'recall', 'new')`,
    [conceptId]
  );

  await client.end();
  console.log("seed complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
