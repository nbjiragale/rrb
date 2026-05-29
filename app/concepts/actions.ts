"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createConcept } from "@/lib/db/queries/concepts";

const schema = z.object({
  name: z.string().min(1),
  subject: z.enum(["math", "reasoning", "ga"]),
  topic: z.string().min(1),
  subtopic: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
});

// A2 — author the concept ontology.
export async function addConcept(formData: FormData) {
  const parsed = schema.parse({
    name: formData.get("name"),
    subject: formData.get("subject"),
    topic: formData.get("topic"),
    subtopic: formData.get("subtopic") || null,
    description: formData.get("description") || null,
  });
  await createConcept(parsed);
  revalidatePath("/concepts");
  revalidatePath("/cards");
}
