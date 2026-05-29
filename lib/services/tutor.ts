import { complete, type ChatMessage } from "@/lib/llm/router";
import { getConcept } from "@/lib/db/queries/concepts";
import { getMastery } from "@/lib/db/queries/mastery";
import { getRecentErrors } from "@/lib/db/queries/attempts";
import { buildTutorSystemPrompt, buildTutorMemoryBlock } from "@/lib/llm/prompts/tutor";

// Read path (architecture §8): assemble the relevant memory slice for one
// concept, then make a single LLM call. The model appears to remember the
// learner; it is pure retrieval. (Graph + semantic recall + nightly profile
// plug in at v5/v6 without changing this shape.)
export async function askTutor(input: {
  conceptId: number;
  history: ChatMessage[];
}): Promise<string> {
  const concept = await getConcept(input.conceptId);
  if (!concept) throw new Error(`Concept ${input.conceptId} not found`);

  const [mastery, recentErrors] = await Promise.all([
    getMastery(input.conceptId),
    getRecentErrors(input.conceptId),
  ]);

  const memory = buildTutorMemoryBlock({
    conceptName: concept.name,
    conceptDescription: concept.description,
    profileSummary: null,
    mastery,
    recentErrors,
  });

  return complete({
    system: `${buildTutorSystemPrompt()}\n\n[MEMORY]\n${memory}`,
    messages: input.history,
    task: "tutor",
    maxTokens: 1024,
  });
}
