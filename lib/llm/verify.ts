import { z } from "zod";
import { complete } from "@/lib/llm/router";
import { parseJson } from "@/lib/llm/json";
import { verifyTokens } from "@/lib/config";
import {
  buildSolveSystemPrompt,
  buildSolveUserPrompt,
  buildGroundSystemPrompt,
  buildGroundUserPrompt,
  buildCardGroundSystemPrompt,
  buildCardGroundUserPrompt,
  buildCardFactCheckSystemPrompt,
  buildCardFactCheckUserPrompt,
} from "@/lib/llm/prompts/verify";
import {
  checkStructure,
  judgeMath,
  judgeGa,
  selectGroundedCards,
  type GeneratedQuestion,
  type GeneratedCard,
  type VerifyResult,
  type MathSolve,
  type GaGround,
} from "@/lib/llm/questionChecks";

// THE verify gate (Hard Rule §2, §10). Nothing becomes verified=true without
// clearing this. Structural + decision logic is pure (questionChecks.ts); here
// we wire in the INDEPENDENT LLM pass that re-solves (math) or re-grounds (GA).

export type { GeneratedQuestion, GeneratedCard, VerifyResult } from "@/lib/llm/questionChecks";
export { checkStructure } from "@/lib/llm/questionChecks";

// Injectable verifiers so the gate composes cleanly (§13 dependency inversion).
// Defaults call the LLM; the pure judgement they feed is unit-tested directly.
export type MathVerifier = (q: GeneratedQuestion) => Promise<MathSolve>;
export type GaVerifier = (q: GeneratedQuestion, sourceText: string) => Promise<GaGround>;
export type CardVerifier = (cards: GeneratedCard[], sourceText: string) => Promise<boolean[]>;
export type FactCardVerifier = (cards: GeneratedCard[]) => Promise<boolean[]>;

const solveSchema = z.object({
  correct_option: z.number().int(),
  unique: z.boolean(),
  solvable: z.boolean(),
});
const groundSchema = z.object({ all_grounded: z.boolean(), correct_option: z.number().int() });
const cardGroundSchema = z.object({ grounded: z.array(z.boolean()) });
const cardFactSchema = z.object({ correct: z.array(z.boolean()) });

const llmMathVerifier: MathVerifier = async (q) => {
  const raw = await complete({
    system: buildSolveSystemPrompt(),
    messages: [{ role: "user", content: buildSolveUserPrompt(q.stem, q.options) }],
    task: "generate",
    maxTokens: verifyTokens(),
  });
  return parseJson(raw, solveSchema);
};

const llmGaVerifier: GaVerifier = async (q, sourceText) => {
  const raw = await complete({
    system: buildGroundSystemPrompt(),
    messages: [{ role: "user", content: buildGroundUserPrompt(q.stem, q.options, sourceText) }],
    task: "generate",
    maxTokens: verifyTokens(),
  });
  return parseJson(raw, groundSchema);
};

const llmCardVerifier: CardVerifier = async (cards, sourceText) => {
  const raw = await complete({
    system: buildCardGroundSystemPrompt(),
    messages: [{ role: "user", content: buildCardGroundUserPrompt(cards, sourceText) }],
    task: "generate",
    maxTokens: verifyTokens(),
  });
  return parseJson(raw, cardGroundSchema).grounded;
};

const llmFactCardVerifier: FactCardVerifier = async (cards) => {
  const raw = await complete({
    system: buildCardFactCheckSystemPrompt(),
    messages: [{ role: "user", content: buildCardFactCheckUserPrompt(cards) }],
    task: "generate",
    maxTokens: verifyTokens(),
  });
  return parseJson(raw, cardFactSchema).correct;
};

// Math/reasoning gate: short-circuit on structure, else re-solve and judge.
export async function verifyMathQuestion(
  q: GeneratedQuestion,
  verifier: MathVerifier = llmMathVerifier
): Promise<VerifyResult> {
  const structure = checkStructure(q);
  if (!structure.ok) return structure;
  return judgeMath(q, await verifier(q));
}

// GA gate: requires source text (grounding is by construction), then judges.
export async function verifyGaQuestion(
  q: GeneratedQuestion,
  sourceText: string,
  verifier: GaVerifier = llmGaVerifier
): Promise<VerifyResult> {
  if (!sourceText?.trim()) return { ok: false, reason: "GA verification requires source text" };
  const structure = checkStructure(q);
  if (!structure.ok) return structure;
  return judgeGa(q, sourceText, await verifier(q, sourceText));
}

// H2 — grounding gate for CA flashcards; returns the grounded subset.
export async function verifyGroundedCards(
  cards: GeneratedCard[],
  sourceText: string,
  verifier: CardVerifier = llmCardVerifier
): Promise<GeneratedCard[]> {
  if (!sourceText?.trim()) throw new Error("CA card verification requires source text");
  const usable = cards.filter((c) => c.front?.trim() && c.back?.trim());
  if (usable.length === 0) return [];
  const grounded = await verifier(usable, sourceText);
  return selectGroundedCards(usable, grounded);
}

// Math/reasoning flashcard gate: keep only cards whose back the independent
// checker confirms is a correct answer to the front. No source — math facts are
// re-derivable, mirroring the math question re-solve (Hard Rule §2).
export async function verifyFactCards(
  cards: GeneratedCard[],
  verifier: FactCardVerifier = llmFactCardVerifier
): Promise<GeneratedCard[]> {
  const usable = cards.filter((c) => c.front?.trim() && c.back?.trim());
  if (usable.length === 0) return [];
  const correct = await verifier(usable);
  return selectGroundedCards(usable, correct);
}
