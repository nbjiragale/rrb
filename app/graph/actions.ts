"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addEdge } from "@/lib/db/queries/edges";

const schema = z
  .object({
    source_id: z.coerce.number().int().positive(),
    target_id: z.coerce.number().int().positive(),
    relation_type: z.enum(["prerequisite", "related", "contrasts_with"]),
  })
  .refine((d) => d.source_id !== d.target_id, "A concept can't link to itself.");

// A3 — define prerequisite / contrasts_with links the planner and tutor read.
export async function addConceptEdge(formData: FormData): Promise<void> {
  const parsed = schema.parse({
    source_id: formData.get("source_id"),
    target_id: formData.get("target_id"),
    relation_type: formData.get("relation_type"),
  });
  await addEdge(parsed);
  revalidatePath("/graph");
}
