// RRB NTPC concept ontology seed (A1 / build brief §5).
//
// Writes the ontology defined in lib/syllabus.ts into the `concept` hierarchy
// (subject > topic > subtopic > concept) plus the `concept_edge` graph
// (prerequisite + contrasts_with), so the app arrives pre-loaded instead of
// requiring every concept to be hand-entered. Idempotent: re-running inserts
// only what's missing (guarded by name+subject+topic; edges dedup on their PK),
// so it's safe to run after schema changes or new additions.
//
// This file owns persistence only — the syllabus data itself, and the guarantee
// that it covers every published syllabus line, live in lib/syllabus.ts.
//
// exam_weight is intentionally left at its 1.0 default — the nightly batch
// (recomputePyqStats) derives the real weight from ingested PYQ frequency, so
// seeding a weight here would just be overwritten.
//
// Usage: DATABASE_URL=... npm run db:seed:ontology
import pg from "pg";
import {
  CONCEPTS,
  CONTRASTS,
  PREREQUISITES,
  SYLLABUS_LINES,
  uncoveredSyllabusLines,
} from "../lib/syllabus.ts";

// `pg` is CommonJS — named imports fail under Node's ESM loader.
const { Client } = pg;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  // Fail before touching the DB rather than seeding a syllabus with holes in it.
  const uncovered = uncoveredSyllabusLines();
  if (uncovered.length > 0) {
    throw new Error(
      `syllabus lines with no concept: ${uncovered.map((l) => l.title).join("; ")}`
    );
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  await client.query("BEGIN");
  try {
    let inserted = 0;
    for (const c of CONCEPTS) {
      const res = await client.query(
        `INSERT INTO concept (name, subject, topic, subtopic, description)
         SELECT $1, $2, $3, $4, $5
         WHERE NOT EXISTS (
           SELECT 1 FROM concept WHERE name = $1 AND subject = $2 AND topic = $3
         )`,
        [c.name, c.subject, c.topic, c.subtopic ?? null, c.description ?? null]
      );
      inserted += res.rowCount ?? 0;
    }

    // name → id, for edge wiring. Names are unique within this ontology.
    const rows = await client.query<{ id: number; name: string }>(`SELECT id, name FROM concept`);
    const idByName = new Map(rows.rows.map((r) => [r.name, r.id]));

    const resolve = (name: string, kind: string): number => {
      const id = idByName.get(name);
      if (id === undefined) throw new Error(`${kind} references unknown concept: "${name}"`);
      return id;
    };

    let edges = 0;
    const addEdge = async (sourceId: number, targetId: number, relation: string) => {
      const res = await client.query(
        `INSERT INTO concept_edge (source_id, target_id, relation_type)
         VALUES ($1, $2, $3)
         ON CONFLICT (source_id, target_id, relation_type) DO NOTHING`,
        [sourceId, targetId, relation]
      );
      edges += res.rowCount ?? 0;
    };

    for (const [dependent, foundation] of PREREQUISITES) {
      await addEdge(resolve(dependent, "prerequisite"), resolve(foundation, "prerequisite"), "prerequisite");
    }
    // contrasts_with is symmetric: store both directions so either side surfaces the other.
    for (const [a, b] of CONTRASTS) {
      const ida = resolve(a, "contrasts_with");
      const idb = resolve(b, "contrasts_with");
      await addEdge(ida, idb, "contrasts_with");
      await addEdge(idb, ida, "contrasts_with");
    }

    await client.query("COMMIT");
    console.log(
      `ontology seed complete: ${CONCEPTS.length} concepts defined (${inserted} new) ` +
        `covering all ${SYLLABUS_LINES.length} published syllabus lines, ` +
        `${PREREQUISITES.length} prerequisite + ${CONTRASTS.length} contrast pairs (${edges} new edges)`
    );
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
