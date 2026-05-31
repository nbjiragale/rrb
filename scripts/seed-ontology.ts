// RRB NTPC concept ontology seed (A1 / build brief §5).
//
// Populates the `concept` hierarchy (subject > topic > subtopic > concept) plus
// the `concept_edge` graph (prerequisite + contrasts_with) so the app arrives
// pre-loaded instead of requiring every concept to be hand-entered. Idempotent:
// re-running inserts only what's missing (guarded by name+subject+topic; edges
// dedup on their PK), so it's safe to run after schema changes or new additions.
//
// exam_weight is intentionally left at its 1.0 default — the nightly batch
// (recomputePyqStats) derives the real weight from ingested PYQ frequency, so
// seeding a weight here would just be overwritten.
//
// Usage: DATABASE_URL=... npm run db:seed:ontology
import { Client } from "pg";

type Subject = "math" | "reasoning" | "ga";

interface ConceptSeed {
  name: string;
  subject: Subject;
  topic: string;
  subtopic?: string;
  description?: string;
}

// prerequisite: [dependent, foundation] — edge is stored source=dependent,
// target=foundation, matching the planner's learnability gate (a concept is
// learnable only once every foundation's p_known ≥ 0.70).
type PrereqPair = [dependent: string, foundation: string];

// contrasts_with: [a, b] — the pair a learner tends to confuse. Stored in BOTH
// directions so the tutor surfaces the partner whichever side is weak.
type ContrastPair = [string, string];

const CONCEPTS: ConceptSeed[] = [
  // ── Mathematics ─────────────────────────────────────────────────────────
  { name: "Number System", subject: "math", topic: "Arithmetic", description: "Integers, factors, divisibility, place value." },
  { name: "HCF and LCM", subject: "math", topic: "Arithmetic" },
  { name: "Decimals and Fractions", subject: "math", topic: "Arithmetic" },
  { name: "Simplification (BODMAS)", subject: "math", topic: "Arithmetic" },
  { name: "Percentages", subject: "math", topic: "Arithmetic" },
  { name: "Ratio and Proportion", subject: "math", topic: "Arithmetic" },
  { name: "Average", subject: "math", topic: "Arithmetic" },
  { name: "Profit and Loss", subject: "math", topic: "Commercial Math" },
  { name: "Discount", subject: "math", topic: "Commercial Math" },
  { name: "Simple Interest", subject: "math", topic: "Commercial Math", subtopic: "Interest" },
  { name: "Compound Interest", subject: "math", topic: "Commercial Math", subtopic: "Interest" },
  { name: "Time and Work", subject: "math", topic: "Applied Arithmetic" },
  { name: "Pipes and Cisterns", subject: "math", topic: "Applied Arithmetic" },
  { name: "Time, Speed and Distance", subject: "math", topic: "Applied Arithmetic" },
  { name: "Problems on Trains", subject: "math", topic: "Applied Arithmetic" },
  { name: "Boats and Streams", subject: "math", topic: "Applied Arithmetic" },
  { name: "Elementary Algebra", subject: "math", topic: "Algebra" },
  { name: "Linear Equations", subject: "math", topic: "Algebra" },
  { name: "Geometry", subject: "math", topic: "Geometry and Mensuration" },
  { name: "Mensuration", subject: "math", topic: "Geometry and Mensuration" },
  { name: "Trigonometry", subject: "math", topic: "Geometry and Mensuration" },
  { name: "Mean, Median and Mode", subject: "math", topic: "Statistics" },
  { name: "Data Interpretation", subject: "math", topic: "Statistics", description: "Reading tables, bar/line/pie charts." },
  { name: "Probability", subject: "math", topic: "Statistics" },

  // ── General Intelligence & Reasoning ────────────────────────────────────
  { name: "Number Series", subject: "reasoning", topic: "Series" },
  { name: "Letter and Alphabet Series", subject: "reasoning", topic: "Series" },
  { name: "Analogies", subject: "reasoning", topic: "Analogy and Classification" },
  { name: "Odd One Out", subject: "reasoning", topic: "Analogy and Classification" },
  { name: "Coding-Decoding", subject: "reasoning", topic: "Coding" },
  { name: "Mathematical Operations", subject: "reasoning", topic: "Operations" },
  { name: "Syllogism", subject: "reasoning", topic: "Logical Reasoning" },
  { name: "Venn Diagrams", subject: "reasoning", topic: "Logical Reasoning" },
  { name: "Statement and Conclusion", subject: "reasoning", topic: "Logical Reasoning" },
  { name: "Statement and Assumption", subject: "reasoning", topic: "Logical Reasoning" },
  { name: "Blood Relations", subject: "reasoning", topic: "Arrangement" },
  { name: "Direction Sense", subject: "reasoning", topic: "Arrangement" },
  { name: "Seating Arrangement", subject: "reasoning", topic: "Arrangement" },
  { name: "Ranking and Ordering", subject: "reasoning", topic: "Arrangement" },
  { name: "Calendar", subject: "reasoning", topic: "Date and Time" },
  { name: "Clock", subject: "reasoning", topic: "Date and Time" },
  { name: "Data Sufficiency", subject: "reasoning", topic: "Analytical Reasoning" },
  { name: "Cubes and Dice", subject: "reasoning", topic: "Spatial Reasoning" },
  { name: "Mirror and Water Images", subject: "reasoning", topic: "Spatial Reasoning" },
  { name: "Paper Folding and Cutting", subject: "reasoning", topic: "Spatial Reasoning" },

  // ── General Awareness ───────────────────────────────────────────────────
  // Polity
  { name: "Indian Constitution", subject: "ga", topic: "Indian Polity", description: "Making, sources, salient features, schedules." },
  { name: "Preamble", subject: "ga", topic: "Indian Polity" },
  { name: "Fundamental Rights", subject: "ga", topic: "Indian Polity", subtopic: "Rights and Duties" },
  { name: "Directive Principles of State Policy", subject: "ga", topic: "Indian Polity", subtopic: "Rights and Duties" },
  { name: "President of India", subject: "ga", topic: "Indian Polity", subtopic: "Executive" },
  { name: "Governor", subject: "ga", topic: "Indian Polity", subtopic: "Executive" },
  { name: "Prime Minister and Council of Ministers", subject: "ga", topic: "Indian Polity", subtopic: "Executive" },
  { name: "Lok Sabha", subject: "ga", topic: "Indian Polity", subtopic: "Parliament" },
  { name: "Rajya Sabha", subject: "ga", topic: "Indian Polity", subtopic: "Parliament" },
  { name: "Supreme Court", subject: "ga", topic: "Indian Polity", subtopic: "Judiciary" },
  { name: "Panchayati Raj", subject: "ga", topic: "Indian Polity", subtopic: "Local Government" },
  // History
  { name: "Indus Valley Civilization", subject: "ga", topic: "History", subtopic: "Ancient" },
  { name: "Vedic Period", subject: "ga", topic: "History", subtopic: "Ancient" },
  { name: "Mauryan Empire", subject: "ga", topic: "History", subtopic: "Ancient" },
  { name: "Gupta Empire", subject: "ga", topic: "History", subtopic: "Ancient" },
  { name: "Delhi Sultanate", subject: "ga", topic: "History", subtopic: "Medieval" },
  { name: "Mughal Empire", subject: "ga", topic: "History", subtopic: "Medieval" },
  { name: "Indian Freedom Struggle", subject: "ga", topic: "History", subtopic: "Modern" },
  { name: "Indian National Congress", subject: "ga", topic: "History", subtopic: "Modern" },
  // Geography
  { name: "Physical Geography of India", subject: "ga", topic: "Geography", subtopic: "India" },
  { name: "Indian Rivers", subject: "ga", topic: "Geography", subtopic: "India" },
  { name: "Climate of India", subject: "ga", topic: "Geography", subtopic: "India" },
  { name: "Indian Agriculture", subject: "ga", topic: "Geography", subtopic: "India" },
  { name: "Solar System", subject: "ga", topic: "Geography", subtopic: "World" },
  { name: "Continents and Oceans", subject: "ga", topic: "Geography", subtopic: "World" },
  // Economy
  { name: "Indian Economy Basics", subject: "ga", topic: "Economics" },
  { name: "Banking and RBI", subject: "ga", topic: "Economics" },
  { name: "Union Budget and Taxation", subject: "ga", topic: "Economics" },
  // Science
  { name: "Units and Measurement", subject: "ga", topic: "General Science", subtopic: "Physics" },
  { name: "Motion and Force", subject: "ga", topic: "General Science", subtopic: "Physics" },
  { name: "Work, Energy and Power", subject: "ga", topic: "General Science", subtopic: "Physics" },
  { name: "Atomic Structure", subject: "ga", topic: "General Science", subtopic: "Chemistry" },
  { name: "Periodic Table", subject: "ga", topic: "General Science", subtopic: "Chemistry" },
  { name: "Acids, Bases and Salts", subject: "ga", topic: "General Science", subtopic: "Chemistry" },
  { name: "Cell Biology", subject: "ga", topic: "General Science", subtopic: "Biology" },
  { name: "Human Body Systems", subject: "ga", topic: "General Science", subtopic: "Biology" },
  { name: "Nutrition and Diseases", subject: "ga", topic: "General Science", subtopic: "Biology" },
  // Static GK
  { name: "Important Days and Dates", subject: "ga", topic: "Static GK" },
  { name: "Books and Authors", subject: "ga", topic: "Static GK" },
  { name: "Awards and Honours", subject: "ga", topic: "Static GK" },
  { name: "Sports and Games", subject: "ga", topic: "Static GK" },
];

const PREREQUISITES: PrereqPair[] = [
  // Arithmetic spine
  ["Percentages", "Number System"],
  ["Ratio and Proportion", "Number System"],
  ["Average", "Number System"],
  ["Profit and Loss", "Percentages"],
  ["Discount", "Percentages"],
  ["Simple Interest", "Percentages"],
  ["Compound Interest", "Simple Interest"],
  ["Time and Work", "Ratio and Proportion"],
  ["Pipes and Cisterns", "Time and Work"],
  ["Time, Speed and Distance", "Ratio and Proportion"],
  ["Problems on Trains", "Time, Speed and Distance"],
  ["Boats and Streams", "Time, Speed and Distance"],
  ["Data Interpretation", "Percentages"],
  ["Data Interpretation", "Average"],
  ["Probability", "Ratio and Proportion"],
  ["Linear Equations", "Elementary Algebra"],
  ["Mensuration", "Geometry"],
  ["Trigonometry", "Geometry"],
  // Reasoning
  ["Seating Arrangement", "Direction Sense"],
  // Polity
  ["Preamble", "Indian Constitution"],
  ["Fundamental Rights", "Indian Constitution"],
  ["Directive Principles of State Policy", "Indian Constitution"],
  ["President of India", "Indian Constitution"],
  ["Governor", "Indian Constitution"],
  ["Prime Minister and Council of Ministers", "Indian Constitution"],
  ["Lok Sabha", "Indian Constitution"],
  ["Rajya Sabha", "Indian Constitution"],
  ["Supreme Court", "Indian Constitution"],
  ["Panchayati Raj", "Indian Constitution"],
  // History chronology
  ["Indian National Congress", "Indian Freedom Struggle"],
  ["Mughal Empire", "Delhi Sultanate"],
  // Economy
  ["Banking and RBI", "Indian Economy Basics"],
  ["Union Budget and Taxation", "Indian Economy Basics"],
  // Science
  ["Work, Energy and Power", "Motion and Force"],
  ["Motion and Force", "Units and Measurement"],
  ["Periodic Table", "Atomic Structure"],
  ["Human Body Systems", "Cell Biology"],
];

const CONTRASTS: ContrastPair[] = [
  ["Simple Interest", "Compound Interest"],
  ["Profit and Loss", "Discount"],
  ["President of India", "Governor"],
  ["Lok Sabha", "Rajya Sabha"],
  ["Fundamental Rights", "Directive Principles of State Policy"],
  ["Time and Work", "Pipes and Cisterns"],
  ["Statement and Conclusion", "Statement and Assumption"],
  ["Analogies", "Odd One Out"],
  ["Calendar", "Clock"],
  ["Mauryan Empire", "Gupta Empire"],
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
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
      `ontology seed complete: ${CONCEPTS.length} concepts defined (${inserted} new), ` +
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
