"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { saveExamConfig } from "@/lib/db/queries/examConfig";

const sectionSchema = z.object({
  name: z.string().trim().min(1, "Section name is required."),
  questions: z.coerce.number().int().min(1),
  marks: z.coerce.number().min(0),
  time_s: z.coerce.number().int().min(0),
});

const schema = z.object({
  exam_name: z.string().trim().min(1, "Exam name is required."),
  // Empty string → null (no exam date set).
  exam_date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  negative_mark_ratio: z.coerce.number().min(0).max(1),
  locale: z.string().trim().min(1).default("en"),
  sections: z.array(sectionSchema).min(1, "Add at least one section."),
});

export type ExamConfigState = { ok: boolean; message: string };

export async function saveExamConfigAction(input: unknown): Promise<ExamConfigState> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  try {
    await saveExamConfig({ ...parsed.data, exam_date: parsed.data.exam_date ?? null });
    // The exam config drives mocks, the planner backstop, and readiness.
    revalidatePath("/mock");
    revalidatePath("/planner");
    revalidatePath("/dashboard");
    revalidatePath("/exam");
    return { ok: true, message: "Exam configuration saved." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Save failed." };
  }
}
