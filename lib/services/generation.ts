import { z } from "zod";
import { complete } from "@/lib/llm/router";
import { parseJson } from "@/lib/llm/json";
import {
  buildMathSystemPrompt,
  buildMathUserPrompt,
  buildGaSystemPrompt,
  buildGaUserPrompt,
  buildAdversarialSystemPrompt,
  buildAdversarialUserPrompt,
} from "@/lib/llm/prompts/generate";
import {
  verifyMathQuestion,
  verifyGaQuestion,
  type GeneratedQuestion,
  type VerifyResult,
} from "@/lib/llm/verify";
import { getConcept } from "@/lib/db/queries/concepts";
import { createGeneratedQuestion, getQuestionDetail } from "@/lib/db/queries/questions";
import { getAttemptForDiagnosis } from "@/lib/db/queries/attempts";
import { getMisconceptionForAttempt } from "@/lib/db/queries/misconceptions";
import { getCaItem } from "@/lib/db/queries/currentAffairs";
import { diagnoseAttempt } from "@/lib/services/diagnosis";

const candidatesSchema = z.array(
  z.object({
    stem: z.string().min(1),
    options: z.array(z.string()).length(4),
    correct_option: z.number().int().min(0).max(3),
    explanation: z.string().optional().nullable(),
  })
);

export type Difficulty = "easy" | "medium" | "hard";
const DIFFICULTY_VALUE: Record<Difficulty, number> = { easy: 0.3, medium: 0.5, hard: 0.75 };

export interface GenerationReport {
  generated: number;
  verified: number;
  rejected: { stem: string; reason: string }[];
  questionIds: number[];
}

// C3 — fresh math/reasoning questions. Free generation, but each candidate must
// clear the independent re-solve in the verify gate before it is persisted as
// verified. Only verified rows are ever served (Hard Rule §2).
export async function generateMathQuestions(input: {
  conceptId: number;
  difficulty: Difficulty;
  count: number;
}): Promise<GenerationReport> {
  const concept = await getConcept(input.conceptId);
  if (!concept) throw new Error(`Concept ${input.conceptId} not found`);
  if (concept.subject === "ga") {
    throw new Error("GA concepts must use grounded generation, not free math generation.");
  }

  const raw = await complete({
    system: buildMathSystemPrompt(),
    messages: [
      {
        role: "user",
        content: buildMathUserPrompt({
          conceptName: concept.name,
          topic: concept.topic,
          difficulty: input.difficulty,
          count: input.count,
        }),
      },
    ],
    task: "generate",
    maxTokens: 1500,
  });

  const candidates = parseJson(raw, candidatesSchema);
  return persistVerified(candidates, {
    verify: (q) => verifyMathQuestion(q),
    conceptId: input.conceptId,
    source: "ai_generated",
    gen_source: `generated:${concept.subject}`,
    difficulty: DIFFICULTY_VALUE[input.difficulty],
  });
}

// C4 — GA questions built strictly from a source passage (Hard Rule §2.1).
// Ungrounded generation is impossible by construction: a missing/empty source
// throws here, before any model call.
export async function generateGaQuestions(input: {
  conceptId: number;
  sourceText: string;
  genSource: string; // 'ca:<id>' | 'passage'
  count: number;
}): Promise<GenerationReport> {
  if (!input.sourceText?.trim()) {
    throw new Error("GA generation requires source text — ungrounded GA is not allowed.");
  }
  const concept = await getConcept(input.conceptId);
  if (!concept) throw new Error(`Concept ${input.conceptId} not found`);
  if (concept.subject !== "ga") {
    throw new Error("Grounded GA generation is only for GA concepts.");
  }

  const raw = await complete({
    system: buildGaSystemPrompt(),
    messages: [
      {
        role: "user",
        content: buildGaUserPrompt({
          conceptName: concept.name,
          sourceText: input.sourceText,
          count: input.count,
        }),
      },
    ],
    task: "generate",
    maxTokens: 1500,
  });

  const candidates = parseJson(raw, candidatesSchema);
  return persistVerified(candidates, {
    verify: (q) => verifyGaQuestion(q, input.sourceText),
    conceptId: input.conceptId,
    source: "ai_generated",
    gen_source: input.genSource,
  });
}

// C5 — adversarial variant of a missed question. Built from the wrong attempt +
// its diagnosed misconception; lineage kept via parent_question_id. Verified
// through the same gate. GA parents need a recoverable source (their CA item),
// otherwise grounding can't be guaranteed and we refuse rather than invent.
export async function generateAdversarial(attemptId: number): Promise<GenerationReport> {
  const a = await getAttemptForDiagnosis(attemptId);
  if (!a) throw new Error(`Attempt ${attemptId} not found`);

  // Ensure a misconception exists to target (C5 depends on the diagnosis).
  let mc = await getMisconceptionForAttempt(attemptId);
  if (!mc) {
    await diagnoseAttempt(attemptId);
    mc = await getMisconceptionForAttempt(attemptId);
  }
  if (!mc) throw new Error("No misconception diagnosed for this attempt yet.");

  const concept = await getConcept(a.concept_id);
  if (!concept) throw new Error(`Concept ${a.concept_id} not found`);

  const raw = await complete({
    system: buildAdversarialSystemPrompt(),
    messages: [
      {
        role: "user",
        content: buildAdversarialUserPrompt({
          conceptName: a.concept_name,
          stem: a.stem,
          options: a.options,
          correctText: a.correct_text,
          selectedText: a.selected_text,
          misconceptionLabel: mc.label,
          misconceptionDescription: mc.description,
        }),
      },
    ],
    task: "generate",
    maxTokens: 1000,
  });

  const candidates = parseJson(raw, candidatesSchema);

  // GA adversarial items must stay grounded. Recover the source from the parent's
  // gen_source if it points at a CA item; otherwise refuse (never invent GA).
  let verify: (q: GeneratedQuestion) => Promise<VerifyResult>;
  if (concept.subject === "ga") {
    const sourceText = await recoverGaSource(a.question_id);
    if (!sourceText) {
      throw new Error("Cannot ground a GA adversarial variant from this question's source.");
    }
    verify = (q) => verifyGaQuestion(q, sourceText);
  } else {
    verify = (q) => verifyMathQuestion(q);
  }

  return persistVerified(candidates.slice(0, 1), {
    verify,
    conceptId: a.concept_id,
    source: "adversarial",
    gen_source: `attempt:${attemptId}`,
    is_adversarial: true,
    parent_question_id: a.question_id,
  });
}

// Recover the grounding source for a GA question whose gen_source is 'ca:<id>'.
// Only CA-backed parents can be re-grounded; PYQ/passage parents return null so
// the caller refuses rather than inventing a GA fact.
async function recoverGaSource(questionId: number): Promise<string | null> {
  const q = await getQuestionDetail(questionId);
  const match = q?.gen_source?.match(/^ca:(\d+)$/);
  if (!match) return null;
  const ca = await getCaItem(Number(match[1]));
  return ca?.raw_text ?? null;
}

// Shared: run each candidate through the gate, persist the verified ones.
async function persistVerified(
  candidates: GeneratedQuestion[],
  opts: {
    verify: (q: GeneratedQuestion) => Promise<VerifyResult>;
    conceptId: number;
    source: "ai_generated" | "adversarial";
    gen_source: string;
    difficulty?: number;
    is_adversarial?: boolean;
    parent_question_id?: number;
  }
): Promise<GenerationReport> {
  const report: GenerationReport = {
    generated: candidates.length,
    verified: 0,
    rejected: [],
    questionIds: [],
  };

  for (const c of candidates) {
    const result = await opts.verify(c);
    if (!result.ok) {
      report.rejected.push({ stem: c.stem.slice(0, 80), reason: result.reason });
      continue;
    }
    const q = await createGeneratedQuestion({
      concept_id: opts.conceptId,
      stem: c.stem,
      options: c.options,
      correct_option: c.correct_option,
      explanation: c.explanation ?? null,
      source: opts.source,
      gen_source: opts.gen_source,
      is_adversarial: opts.is_adversarial,
      parent_question_id: opts.parent_question_id ?? null,
      difficulty: opts.difficulty ?? null,
      verified: true, // set ONLY here, after the gate passed
    });
    report.verified++;
    report.questionIds.push(q.id);
  }

  return report;
}
