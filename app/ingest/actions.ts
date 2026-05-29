"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createQuestion, findDuplicateQuestion } from "@/lib/db/queries/questions";

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
