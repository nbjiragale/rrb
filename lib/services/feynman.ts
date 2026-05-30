import { z } from "zod";
import { complete, isLlmConfigured } from "@/lib/llm/router";
import { parseJson } from "@/lib/llm/json";
import { tryEmbed } from "@/lib/llm/embed";
import { buildFeynmanSystemPrompt, buildFeynmanUserPrompt } from "@/lib/llm/prompts/feynman";
import { getConcept } from "@/lib/db/queries/concepts";
import { insertInteraction, listInteractionsByConcept } from "@/lib/db/queries/interactions";
import type { Interaction } from "@/lib/db/types";

export interface FeynmanFeedback {
  rating: "solid" | "partial" | "shaky";
  assessment: string;
  gaps: string[];
}

const schema = z.object({
  rating: z.enum(["solid", "partial", "shaky"]),
  assessment: z.string().min(1),
  gaps: z.array(z.string()),
});

// J1/G5 — grade a Feynman explanation and store it as durable, recallable memory
// (embedded if a provider is configured; otherwise stored now, embedded nightly).
export async function gradeFeynman(input: {
  conceptId: number;
  explanation: string;
}): Promise<{ feedback: FeynmanFeedback; interaction: Interaction }> {
  if (!isLlmConfigured()) throw new Error("LLM not configured — Feynman grading needs it.");
  const concept = await getConcept(input.conceptId);
  if (!concept) throw new Error(`Concept ${input.conceptId} not found`);

  const raw = await complete({
    system: buildFeynmanSystemPrompt(),
    messages: [
      {
        role: "user",
        content: buildFeynmanUserPrompt({
          conceptName: concept.name,
          conceptDescription: concept.description,
          explanation: input.explanation,
        }),
      },
    ],
    task: "tutor",
    maxTokens: 600,
  });

  const feedback = parseJson(raw, schema);
  const aiFeedback = [feedback.assessment, ...feedback.gaps.map((g) => `• ${g}`)].join("\n");

  const embedding = await tryEmbed(input.explanation);
  const interaction = await insertInteraction({
    type: "feynman",
    concept_id: input.conceptId,
    content: input.explanation,
    ai_feedback: aiFeedback,
    embedding,
  });

  return { feedback, interaction };
}

export async function getFeynmanHistory(conceptId: number): Promise<Interaction[]> {
  return listInteractionsByConcept(conceptId, "feynman");
}
