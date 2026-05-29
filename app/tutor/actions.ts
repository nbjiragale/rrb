"use server";

import { z } from "zod";
import { askTutor } from "@/lib/services/tutor";

const schema = z.object({
  conceptId: z.number().int().positive(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1),
      })
    )
    .min(1),
});

// E1/E2/K1 — answer a doubt using the read-path (retrieval, not fine-tuning).
export async function sendTutorMessage(input: {
  conceptId: number;
  history: { role: "user" | "assistant"; content: string }[];
}): Promise<{ reply: string }> {
  const parsed = schema.parse(input);
  const reply = await askTutor(parsed);
  return { reply };
}
