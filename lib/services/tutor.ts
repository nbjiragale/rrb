import {
  complete,
  completeGrounded,
  isGroundingConfigured,
  tutorWebSearchEnabled,
  type Citation,
  type ChatMessage,
} from "@/lib/llm/router";
import { tryEmbed } from "@/lib/llm/embed";
import { getConcept } from "@/lib/db/queries/concepts";
import { getMastery } from "@/lib/db/queries/mastery";
import { getRecentErrors } from "@/lib/db/queries/attempts";
import { getLatestProfile } from "@/lib/db/queries/learnerProfile";
import { getContrastConcepts, getPrerequisiteConcepts } from "@/lib/db/queries/edges";
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

  const [mastery, recentErrors, profile, contrasts, prerequisites, semanticMatches] =
    await Promise.all([
      getMastery(input.conceptId),
      getRecentErrors(input.conceptId),
      getLatestProfile(),
      getContrastConcepts(input.conceptId),
      getPrerequisiteConcepts(input.conceptId),
      queryEmbedding ? searchInteractions(queryEmbedding, 5) : Promise.resolve<SemanticMatch[]>([]),
    ]);

  const memory = buildTutorMemoryBlock({
    conceptName: concept.name,
    conceptDescription: concept.description,
    mastery,
    recentErrors,
    semanticMatches,
    contrasts,
    prerequisites,
  });

  // Cache the stable prefix (persona + nightly profile); keep the per-concept
  // memory slice uncached as it varies every call (§8 / Hard Rule §4).
  const system = [
    { text: buildTutorCachedPrefix(profile?.summary_text ?? null), cache: true },
    { text: `[MEMORY]\n${memory}`, cache: false },
  ];

  // Prefer grounded search (Gemini + Google Search) when configured: factual
  // answers come with citations the learner can verify. Otherwise fall back to
  // the cheap router, optionally with OpenRouter's web plugin.
  let answer: string;
  if (isGroundingConfigured()) {
    const grounded = await completeGrounded({ system, messages: input.history, maxTokens: 4096 });
    answer = grounded.text + formatCitations(grounded.citations);
  } else {
    answer = await complete({
      system,
      messages: input.history,
      task: "tutor",
      maxTokens: 4096,
      // Live web search for factual accuracy (current affairs, recent facts).
      web: tutorWebSearchEnabled(),
    });
  }

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

// Render grounding sources as a quiet markdown footer the chat UI already knows
// how to display (links). Empty when the turn wasn't grounded.
function formatCitations(citations: Citation[]): string {
  if (citations.length === 0) return "";
  const lines = citations.map((c) => `- [${c.title ?? c.uri}](${c.uri})`);
  return `\n\n---\nSources:\n${lines.join("\n")}`;
}
