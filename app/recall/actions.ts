"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { saveNote, recallMemory, type RecallResult } from "@/lib/services/memory";

const noteSchema = z.object({
  conceptId: z.number().int().positive().nullable(),
  content: z.string().trim().min(3, "Write a little more."),
});

export interface SaveNoteResult {
  ok: boolean;
  message?: string;
}

// J2 — capture a free-form study note as recallable memory.
export async function saveNoteAction(input: {
  conceptId: number | null;
  content: string;
}): Promise<SaveNoteResult> {
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  try {
    await saveNote(parsed.data);
    revalidatePath("/recall");
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not save note." };
  }
}

const recallSchema = z.object({
  query: z.string().trim().min(2, "Type at least a couple of characters."),
  type: z.enum(["feynman", "doubt", "note"]).nullable().optional(),
});

export type RecallActionResult = { ok: true; result: RecallResult } | { ok: false; message: string };

// J2 — semantic (or keyword-fallback) recall over the learner's own memory.
export async function recallAction(input: {
  query: string;
  type?: "feynman" | "doubt" | "note" | null;
}): Promise<RecallActionResult> {
  const parsed = recallSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid query." };
  }
  try {
    const result = await recallMemory({ query: parsed.data.query, type: parsed.data.type ?? null });
    return { ok: true, result };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Recall failed." };
  }
}
