import { withTransaction } from "@/lib/db/client";
import { createQuestion, findDuplicateQuestion } from "@/lib/db/queries/questions";
import { getConceptIdMap } from "@/lib/db/queries/concepts";
import { parsePyqBatch, type RowError } from "@/lib/services/pyqParse";

// Bulk PYQ import (A2). PYQs are real past-paper questions — ground truth, not
// model output — so they are stored verified=true and bypass the LLM verify
// gate (Hard Rule §2 covers AI-*generated* content only). The work here is
// structural validation (pyqParse) + concept resolution + duplicate rejection.

export interface PyqImportResult {
  inserted: number;
  duplicates: number;
  errors: RowError[];
  total: number;
}

// Full import: parse, resolve concepts, dedup, insert valid rows. One bad row
// never sinks the batch — it's reported and the rest still import. The inserts
// run in a single transaction so a mid-batch failure leaves no partial state.
export async function importPyqBatch(raw: string): Promise<PyqImportResult> {
  const { rows, errors } = parsePyqBatch(raw);
  const total = rows.length + errors.length;

  if (rows.length === 0) {
    return { inserted: 0, duplicates: 0, errors, total };
  }

  // Resolve concept references (id or name) up front against one snapshot.
  const conceptMap = await getConceptIdMap();
  const byId = new Set(conceptMap.map((c) => c.id));
  const byName = new Map(conceptMap.map((c) => [c.name.toLowerCase(), c.id]));

  const resolveConcept = (ref: number | string): number | null => {
    if (typeof ref === "number") return byId.has(ref) ? ref : null;
    return byName.get(ref.trim().toLowerCase()) ?? null;
  };

  let inserted = 0;
  let duplicates = 0;

  await withTransaction(async (tx) => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const conceptId = resolveConcept(row.concept);
      if (conceptId === null) {
        errors.push({ index: i, message: `unknown concept: ${JSON.stringify(row.concept)}` });
        continue;
      }

      const dupId = await findDuplicateQuestion(conceptId, row.stem, tx);
      if (dupId) {
        duplicates++;
        continue;
      }

      await createQuestion(
        {
          concept_id: conceptId,
          stem: row.stem,
          options: row.options,
          correct_option: row.correct_option,
          explanation: row.explanation ?? null,
          source: "pyq",
          exam_year: row.exam_year ?? null,
          exam_stage: row.exam_stage ?? null,
          verified: true,
        },
        tx
      );
      inserted++;
    }
  });

  return { inserted, duplicates, errors, total };
}
