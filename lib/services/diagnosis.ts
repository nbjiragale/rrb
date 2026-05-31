import { z } from "zod";
import { withTransaction } from "@/lib/db/client";
import { complete, isLlmConfigured } from "@/lib/llm/router";
import { parseJson } from "@/lib/llm/json";
import { buildDiagnoseSystemPrompt, buildDiagnoseUserPrompt } from "@/lib/llm/prompts/diagnose";
import {
  getAttemptForDiagnosis,
  getUndiagnosedWrongAttempts,
} from "@/lib/db/queries/attempts";
import {
  upsertMisconception,
  insertMisconceptionHit,
  hasDiagnosis,
} from "@/lib/db/queries/misconceptions";
import { conceptHasMaturedCard, surfaceConceptCards } from "@/lib/db/queries/cards";
import type { MisconceptionKind } from "@/lib/db/types";

export interface DiagnosisResult {
  kind: MisconceptionKind;
  label: string;
  description: string;
}

const diagnoseSchema = z.object({
  kind: z.enum(["confusion", "factual_gap", "partial_rule", "computational", "conceptual", "trap"]),
  label: z.string().min(1).max(120),
  description: z.string().min(1),
  rationale: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

// F1 — diagnose one wrong attempt. Idempotent (diagnosed at most once) and
// resilient: a diagnosis failure must never corrupt the attempt flow, so callers
// can fire-and-forget. F4 (stale) is handled deterministically before any LLM
// call — memory decay on a once-known card, not a fresh knowledge gap.
export async function diagnoseAttempt(attemptId: number): Promise<DiagnosisResult | null> {
  if (await hasDiagnosis(attemptId)) return null;

  const a = await getAttemptForDiagnosis(attemptId);
  if (!a || a.is_correct !== false) return null; // only wrong attempts are diagnosed

  // F4 — forgotten-but-once-known: if the concept has a matured card, tag stale
  // and resurface the card rather than treating it as a new gap.
  if (await conceptHasMaturedCard(a.concept_id)) {
    await recordStale(attemptId, a.concept_id, a.concept_name);
    await surfaceConceptCards(a.concept_id);
    return { kind: "stale", label: `forgot_${slug(a.concept_name)}`, description: "Previously known; likely memory decay." };
  }

  if (!isLlmConfigured()) return null;

  const raw = await complete({
    system: buildDiagnoseSystemPrompt(),
    messages: [{ role: "user", content: buildDiagnoseUserPrompt(a) }],
    task: "classify",
    maxTokens: 800,
  });
  const d = parseJson(raw, diagnoseSchema);

  await withTransaction(async (tx) => {
    const id = await upsertMisconception(
      { concept_id: a.concept_id, label: d.label, description: d.description, kind: d.kind },
      tx
    );
    await insertMisconceptionHit(
      { attempt_id: attemptId, misconception_id: id, ai_confidence: d.confidence, ai_rationale: d.rationale },
      tx
    );
  });

  return { kind: d.kind, label: d.label, description: d.description };
}

// Best-effort variant for fire-and-forget callers (practice UI): never throws.
export async function tryDiagnoseAttempt(attemptId: number): Promise<DiagnosisResult | null> {
  try {
    return await diagnoseAttempt(attemptId);
  } catch (err) {
    console.error(`diagnoseAttempt(${attemptId}) failed:`, err);
    return null;
  }
}

// Nightly safety net (architecture §9 step 5): diagnose any wrong attempts the
// interactive path missed (e.g. mock answers). Bounded to control cost.
export async function diagnosePending(limit = 50): Promise<{ diagnosed: number }> {
  const pending = await getUndiagnosedWrongAttempts(limit);
  let diagnosed = 0;
  for (const { id } of pending) {
    const r = await tryDiagnoseAttempt(id);
    if (r) diagnosed++;
  }
  return { diagnosed };
}

async function recordStale(attemptId: number, conceptId: number, conceptName: string): Promise<void> {
  await withTransaction(async (tx) => {
    const id = await upsertMisconception(
      {
        concept_id: conceptId,
        label: `forgot_${slug(conceptName)}`,
        description: "Previously known fact; likely memory decay (FSRS lapse).",
        kind: "stale",
      },
      tx
    );
    await insertMisconceptionHit(
      { attempt_id: attemptId, misconception_id: id, ai_confidence: null, ai_rationale: "Concept has a matured card with prior successes." },
      tx
    );
  });
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);
}
