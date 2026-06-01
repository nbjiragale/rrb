"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { importTestbookMock, type TestbookImportResult } from "@/lib/services/testbookImport";
import { setTagMapping } from "@/lib/db/queries/testbookTags";

const importSchema = z.object({
  rawJson: z.string().min(1, "Paste the Testbook result JSON first."),
  externalTestId: z.string().trim().optional().nullable(),
});

export type ImportState =
  | { ok: true; result: TestbookImportResult }
  | { ok: false; message: string };

// Import a pasted Testbook `studenttestresult` JSON. Validation is fail-fast:
// a non-JSON paste or a payload missing the per-question structure is rejected
// with a clear message rather than partially imported.
export async function importTestbookMockAction(input: {
  rawJson: string;
  externalTestId?: string | null;
}): Promise<ImportState> {
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(parsed.data.rawJson);
  } catch {
    return { ok: false, message: "That isn't valid JSON — copy the full API response." };
  }

  try {
    const result = await importTestbookMock(raw, {
      externalTestId: parsed.data.externalTestId ?? null,
    });
    if (!result.alreadyImported && result.imported > 0) {
      revalidatePath("/dashboard");
      revalidatePath("/diagnosis");
      revalidatePath("/practice");
    }
    return { ok: true, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed.";
    return { ok: false, message };
  }
}

const mapSchema = z.object({
  tag: z.string().trim().min(1),
  conceptId: z.coerce.number().int().positive(),
});

export type MapState = { ok: boolean; message: string };

// Teach the resolver a tag→concept mapping for a previously unmapped Testbook
// topic. Re-running the import then attributes those questions correctly.
export async function mapTestbookTagAction(input: {
  tag: string;
  conceptId: number;
}): Promise<MapState> {
  const parsed = mapSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  await setTagMapping(parsed.data.tag, parsed.data.conceptId);
  return { ok: true, message: `Mapped "${parsed.data.tag}".` };
}
