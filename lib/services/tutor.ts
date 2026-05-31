import { complete, type ChatMessage } from "@/lib/llm/router";
import { tryEmbed } from "@/lib/llm/embed";
import { getConcept } from "@/lib/db/queries/concepts";
import { getMastery } from "@/lib/db/queries/mastery";
import { getRecentErrors } from "@/lib/db/queries/attempts";
import { getLatestProfile } from "@/lib/db/queries/learnerProfile";
import { getContrastConcepts } from "@/lib/db/queries/edges";
import {
  searchInteractions,
  insertInteraction,
  type SemanticMatch,
} from "@/lib/db/queries/interactions";
import { buildTutorCachedPrefix, buildTutorMemoryBlock } from "@/lib/llm/prompts/tutor";

// Read path (architecture §8): assemble the relevant memory slice for one
// concept, then a single LLM call. The model appears to remember the learner;
// it is pure retrieval. v5 added the nightly profile (J3) + semantic recall over
// the learner's own words (J2); v6 adds contrasts_with surfacing (E4).
export async function askTutor(input: {
  conceptId: number;
  history: ChatMessage[];
}): Promise<string> {
  const concept = await getConcept(input.conceptId);
  if (!concept) throw new Error(`Concept ${input.conceptId} not found`);

  const lastUserMessage = [...input.history].reverse().find((m) => m.role === "user")?.content ?? "";
  const queryEmbedding = lastUserMessage ? await tryEmbed(lastUserMessage) : null;

  const [mastery, recentErrors, profile, contrasts, semanticMatches] = await Promise.all([
    getMastery(input.conceptId),
    getRecentErrors(input.conceptId),
    getLatestProfile(),
    getContrastConcepts(input.conceptId),
    queryEmbedding ? searchInteractions(queryEmbedding, 5) : Promise.resolve<SemanticMatch[]>([]),
  ]);

  const memory = buildTutorMemoryBlock({
    conceptName: concept.name,
    conceptDescription: concept.description,
    mastery,
    recentErrors,
    semanticMatches,
    contrasts,
  });

  // Cache the stable prefix (persona + nightly profile); keep the per-concept
  // memory slice uncached as it varies every call (§8 / Hard Rule §4).
  const answer = await complete({
    system: [
      { text: buildTutorCachedPrefix(profile?.summary_text ?? null), cache: true },
      { text: `[MEMORY]\n${memory}`, cache: false },
    ],
    messages: input.history,
    task: "tutor",
    maxTokens: 4096,
  });

  // Store the doubt as recallable memory (walkthrough B) — a future semantic
  // match. Best-effort: never fail the answer over a write.
  if (lastUserMessage) {
    try {
      await insertInteraction({
        type: "doubt",
        concept_id: input.conceptId,
        content: lastUserMessage,
        ai_feedback: answer,
        embedding: queryEmbedding,
      });
    } catch (err) {
      console.error("failed to store tutor interaction:", err);
    }
  }

  return answer;
}
