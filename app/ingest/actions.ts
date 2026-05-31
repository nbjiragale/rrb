"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createQuestion, findDuplicateQuestion } from "@/lib/db/queries/questions";
import { importPyqBatch, type PyqImportResult } from "@/lib/services/pyqImport";

const schema = z.object({
  concept_id: z.coerce.number().int().positive(),
  stem: z.string().min(1),
  options: z.array(z.string().min(1)).length(4),
  correct_option: z.coerce.number().int().min(0).max(3),
  explanation: z.string().trim().optional().nullable(),
  exam_year: z.coerce.number().int().min(1990).max(2100).optional().nullable(),
  exam_stage: z.enum(["cbt1", "cbt2"]).optional().nullable(),
});

export type IngestState = { ok: boolean; message: string };

// A5 — ingest a PYQ: tag to a concept, record provenance, flag duplicates.
// PYQs are real exam questions, so they are stored verified=true.
export async function ingestQuestion(_prev: IngestState, formData: FormData): Promise<IngestState> {
  const parsed = schema.safeParse({
    concept_id: formData.get("concept_id"),
    stem: formData.get("stem"),
    options: [
      formData.get("option_0"),
      formData.get("option_1"),
      formData.get("option_2"),
      formData.get("option_3"),
    ],
    correct_option: formData.get("correct_option"),
    explanation: formData.get("explanation") || null,
    exam_year: formData.get("exam_year") || null,
    exam_stage: formData.get("exam_stage") || null,
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;

  const dupId = await findDuplicateQuestion(data.concept_id, data.stem);
  if (dupId) {
    return { ok: false, message: `Duplicate of question #${dupId} — not added.` };
  }

  const q = await createQuestion({
    concept_id: data.concept_id,
    stem: data.stem,
    options: data.options,
    correct_option: data.correct_option,
    explanation: data.explanation,
    source: "pyq",
    exam_year: data.exam_year,
    exam_stage: data.exam_stage,
    verified: true,
  });

  revalidatePath("/practice");
  return { ok: true, message: `Added question #${q.id}.` };
}

export type BulkIngestState = { ok: boolean; message: string; result: PyqImportResult | null };

// A2 — bulk-ingest PYQs from a pasted JSON batch. PYQs are ground truth, so the
// service stores them verified=true; per-row errors are reported without
// sinking the whole batch.
export async function bulkIngestQuestions(
  _prev: BulkIngestState,
  formData: FormData
): Promise<BulkIngestState> {
  const raw = formData.get("batch");
  if (typeof raw !== "string" || raw.trim() === "") {
    return { ok: false, message: "Paste a JSON batch first.", result: null };
  }

  const result = await importPyqBatch(raw);

  if (result.inserted > 0) revalidatePath("/practice");

  const parts = [`${result.inserted} added`];
  if (result.duplicates > 0) parts.push(`${result.duplicates} duplicate${result.duplicates > 1 ? "s" : ""} skipped`);
  if (result.errors.length > 0) parts.push(`${result.errors.length} row${result.errors.length > 1 ? "s" : ""} rejected`);

  return { ok: result.inserted > 0, message: parts.join(", ") + ".", result };
}
