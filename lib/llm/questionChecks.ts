// Pure decision logic for the verify gate (Hard Rule §2, §10). No I/O — the LLM
// verifier calls live in verify.ts; these functions just judge their results, so
// the gate's correctness is fully unit-testable with fixtures.

export interface GeneratedQuestion {
  stem: string;
  options: string[];
  correct_option: number;
  explanation?: string | null;
}

export interface GeneratedCard {
  front: string;
  back: string;
}

export interface VerifyResult {
  ok: boolean;
  reason: string;
}

const PASS: VerifyResult = { ok: true, reason: "verified" };
const fail = (reason: string): VerifyResult => ({ ok: false, reason });

// Shared structural gate (all sources): exactly 4 distinct non-empty options, a
// correct index in range, a non-empty stem.
export function checkStructure(q: GeneratedQuestion): VerifyResult {
  if (!q.stem?.trim()) return fail("empty stem");
  if (!Array.isArray(q.options) || q.options.length !== 4) return fail("must have exactly 4 options");
  if (q.options.some((o) => !o?.trim())) return fail("an option is empty");
  const norm = q.options.map((o) => o.trim().toLowerCase());
  if (new Set(norm).size !== 4) return fail("options are not all distinct");
  if (!Number.isInteger(q.correct_option) || q.correct_option < 0 || q.correct_option > 3) {
    return fail("correct_option out of range");
  }
  return PASS;
}

export interface MathSolve {
  correct_option: number;
  unique: boolean;
  solvable: boolean;
}

// Math/reasoning judgement: structure + an independent re-solve that must be
// well-posed, unique, and agree with the claimed answer.
export function judgeMath(q: GeneratedQuestion, solve: MathSolve): VerifyResult {
  const structure = checkStructure(q);
  if (!structure.ok) return structure;
  if (!solve.solvable) return fail("verifier: question not well-posed");
  if (!solve.unique) return fail("verifier: more than one correct option");
  if (solve.correct_option !== q.correct_option) return fail("verifier: answer mismatch");
  return PASS;
}

export interface GaGround {
  all_grounded: boolean;
  correct_option: number;
}

// GA judgement: structure + grounding. Every fact must trace to the source and
// the independently determined answer must match (Hard Rule §2.1).
export function judgeGa(
  q: GeneratedQuestion,
  sourceText: string,
  ground: GaGround
): VerifyResult {
  if (!sourceText?.trim()) return fail("GA verification requires source text");
  const structure = checkStructure(q);
  if (!structure.ok) return structure;
  if (!ground.all_grounded) return fail("verifier: a fact does not trace to the source");
  if (ground.correct_option !== q.correct_option) {
    return fail("verifier: source supports a different answer");
  }
  return PASS;
}

// H2 — keep only cards with non-empty front/back whose facts the verifier
// confirmed are grounded in the source. Preserves order.
export function selectGroundedCards(
  cards: GeneratedCard[],
  grounded: boolean[]
): GeneratedCard[] {
  return cards.filter((c, i) => c.front?.trim() && c.back?.trim() && grounded[i] === true);
}
