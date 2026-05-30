"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addEdge, removeEdge } from "@/lib/db/queries/edges";
import { addResource, deleteResource } from "@/lib/db/queries/resources";

const edgeSchema = z
  .object({
    source_id: z.coerce.number().int().positive(),
    target_id: z.coerce.number().int().positive(),
    relation_type: z.enum(["prerequisite", "related", "contrasts_with"]),
  })
  .refine((d) => d.source_id !== d.target_id, "A concept can't link to itself.");

// A3 — define prerequisite / contrasts_with links the planner and tutor read.
export async function addConceptEdge(formData: FormData): Promise<void> {
  const parsed = edgeSchema.parse({
    source_id: formData.get("source_id"),
    target_id: formData.get("target_id"),
    relation_type: formData.get("relation_type"),
  });
  await addEdge(parsed);
  revalidatePath("/graph");
}

export async function removeConceptEdge(input: {
  source_id: number;
  target_id: number;
  relation_type: "prerequisite" | "related" | "contrasts_with";
}): Promise<void> {
  const parsed = edgeSchema.parse(input);
  await removeEdge(parsed);
  revalidatePath("/graph");
}

const resourceSchema = z.object({
  concept_id: z.coerce.number().int().positive(),
  kind: z.enum(["book", "video", "article", "notes"]).nullable(),
  label: z.string().trim().min(1, "Label is required.").max(200),
  url: z.string().trim().url("Enter a valid URL.").or(z.literal("")).nullable(),
  priority: z.coerce.number().int().min(1).max(99),
});

export interface ResourceState {
  ok: boolean;
  message: string;
}

// A4 — attach an external learning source to a concept (routes out, stores nothing).
export async function addConceptResource(
  _prev: ResourceState,
  formData: FormData
): Promise<ResourceState> {
  const parsed = resourceSchema.safeParse({
    concept_id: formData.get("concept_id"),
    kind: formData.get("kind") || null,
    label: formData.get("label"),
    url: formData.get("url") || null,
    priority: formData.get("priority") || 1,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const d = parsed.data;
  await addResource({
    concept_id: d.concept_id,
    kind: d.kind,
    label: d.label,
    url: d.url || null,
    priority: d.priority,
  });
  revalidatePath("/graph");
  return { ok: true, message: `Added "${d.label}".` };
}

export async function removeConceptResource(id: number): Promise<void> {
  const resourceId = z.number().int().positive().parse(id);
  await deleteResource(resourceId);
  revalidatePath("/graph");
}
