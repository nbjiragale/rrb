import { z } from "zod";

// Pure parsing/validation for bulk PYQ import (A2). No DB deps, so it stays
// unit-testable in isolation; the DB-touching import flow lives in pyqImport.ts.

// One row of the import batch. `concept` accepts either a numeric id or a
// concept name (case-insensitive), so a paste can reference the seeded ontology
// by name without the user hunting for ids.
const rowSchema = z
  .object({
    concept: z.union([z.number().int().positive(), z.string().min(1)]),
    stem: z.string().trim().min(1, "stem is empty"),
    options: z.array(z.string().trim().min(1, "option is empty")).length(4, "need exactly 4 options"),
    correct_option: z.coerce.number().int().min(0).max(3),
    explanation: z.string().trim().optional().nullable(),
    exam_year: z.coerce.number().int().min(1990).max(2100).optional().nullable(),
    exam_stage: z.enum(["cbt1", "cbt2"]).optional().nullable(),
  })
  .strict();

export type PyqImportRow = z.infer<typeof rowSchema>;

export interface RowError {
  index: number; // 0-based position in the submitted batch; -1 for envelope errors
  message: string;
}

// Pure parse step (no DB) — keeps validation unit-testable. Accepts a JSON
// array, or an object with a top-level `questions` array. Returns either the
// typed rows or per-row errors; a malformed envelope is a single error at -1.
export function parsePyqBatch(raw: string): { rows: PyqImportRow[]; errors: RowError[] } {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { rows: [], errors: [{ index: -1, message: "Input is not valid JSON." }] };
  }

  const arr = Array.isArray(json)
    ? json
    : json && typeof json === "object" && Array.isArray((json as { questions?: unknown }).questions)
      ? (json as { questions: unknown[] }).questions
      : null;

  if (!arr) {
    return {
      rows: [],
      errors: [{ index: -1, message: "Expected a JSON array of questions (or { questions: [...] })." }],
    };
  }
  if (arr.length === 0) {
    return { rows: [], errors: [{ index: -1, message: "No questions in the batch." }] };
  }

  const rows: PyqImportRow[] = [];
  const errors: RowError[] = [];
  arr.forEach((item, index) => {
    const parsed = rowSchema.safeParse(item);
    if (parsed.success) {
      rows.push(parsed.data);
    } else {
      const issue = parsed.error.issues[0];
      const where = issue?.path.length ? `${issue.path.join(".")}: ` : "";
      errors.push({ index, message: `${where}${issue?.message ?? "invalid row"}` });
    }
  });

  return { rows, errors };
}
