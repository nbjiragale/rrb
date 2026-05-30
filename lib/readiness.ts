// Projected readiness (J3) — pure, no I/O. Blends two independent estimates of
// expected CBT score and reports an HONEST uncertainty band that widens when
// evidence is thin (few attempts, few mocks). The screen states the number with
// explicit uncertainty wording; this module is the maths behind it.

// BKT slip/guess defaults (mirrors lib/bkt.ts DEFAULT_BKT). Inlined so this
// pure module stays self-contained and unit-testable in isolation, like the
// other tested lib/*.ts modules. P(correct) = p·(1−S) + (1−p)·G.
const SLIP = 0.1;
const GUESS = 0.25;
function predictCorrect(pKnown: number): number {
  return pKnown * (1 - SLIP) + (1 - pKnown) * GUESS;
}

export interface ReadinessConcept {
  pKnown: number;
  examWeight: number;
  attempted: boolean;
}

export interface ReadinessInputs {
  totalMarks: number;
  concepts: ReadinessConcept[];
  /** Recent mocks as score fraction = score / total_questions, in [-negRatio, 1]. */
  mockScoreFractions: number[];
  negRatio: number;
  /** Optional target/cutoff marks to compare against. */
  targetMarks?: number | null;
}

export type Confidence = "low" | "medium" | "high";

export interface Readiness {
  expected: number;
  low: number;
  high: number;
  confidence: Confidence;
  /** 0..1 evidence score driving the band width and label. */
  evidence: number;
  nMocks: number;
  coverage: number;
  onTrack: boolean | null;
  note: string;
}

// More mocks ⇒ trust mocks more. K is the half-weight point: at 3 mocks the
// estimate is half mock / half mastery.
const MOCK_HALF_WEIGHT = 3;

export function computeReadiness(input: ReadinessInputs): Readiness {
  const { totalMarks, concepts, mockScoreFractions, negRatio } = input;

  // Mastery estimate: exam-weighted predicted accuracy → expected mark fraction
  // if every question is attempted (honest; untouched concepts drag it down).
  const masteryAccuracy = weightedAccuracy(concepts);
  const masteryFraction = expectedFraction(masteryAccuracy, negRatio);

  const nMocks = mockScoreFractions.length;
  const mockFraction = nMocks > 0 ? mean(mockScoreFractions) : null;

  const mockWeight = nMocks / (nMocks + MOCK_HALF_WEIGHT);
  const blended =
    mockFraction == null ? masteryFraction : mockWeight * mockFraction + (1 - mockWeight) * masteryFraction;

  const coverage = concepts.length === 0 ? 0 : concepts.filter((c) => c.attempted).length / concepts.length;

  // Evidence: half from syllabus coverage, half from mock volume.
  const evidence = clamp(0.5 * coverage + 0.5 * mockWeight, 0, 1);

  // Band: ±5 marks-fraction floor, widening up to ±20 as evidence → 0.
  const sigma = 0.05 + 0.15 * (1 - evidence);

  const expected = blended * totalMarks;
  const worst = -negRatio * totalMarks;
  const low = clamp((blended - sigma) * totalMarks, worst, totalMarks);
  const high = clamp((blended + sigma) * totalMarks, worst, totalMarks);

  const confidence: Confidence = evidence > 0.66 ? "high" : evidence > 0.33 ? "medium" : "low";

  const target = input.targetMarks ?? null;
  // On track only when even the low end clears the target (honest, conservative).
  const onTrack = target == null ? null : low >= target;

  return {
    expected,
    low,
    high,
    confidence,
    evidence,
    nMocks,
    coverage,
    onTrack,
    note: buildNote({ confidence, nMocks, coverage }),
  };
}

function weightedAccuracy(concepts: ReadinessConcept[]): number {
  let num = 0;
  let den = 0;
  for (const c of concepts) {
    const w = c.examWeight > 0 ? c.examWeight : 1;
    num += w * predictCorrect(c.pKnown);
    den += w;
  }
  return den === 0 ? 0 : num / den;
}

// Expected marks fraction under negative marking if all are attempted.
function expectedFraction(accuracy: number, negRatio: number): number {
  return accuracy - (1 - accuracy) * negRatio;
}

function buildNote(d: { confidence: Confidence; nMocks: number; coverage: number }): string {
  if (d.confidence === "high") return "Solid evidence base — this estimate is fairly reliable.";
  const reasons: string[] = [];
  if (d.nMocks < MOCK_HALF_WEIGHT) reasons.push(`take more full mocks (${d.nMocks} so far)`);
  if (d.coverage < 0.5) reasons.push("practise more of the syllabus");
  const why = reasons.length ? ` — ${reasons.join(" and ")}` : "";
  return `Wide band: limited evidence${why}. Treat as a rough guide.`;
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(Math.max(x, lo), hi);
}
