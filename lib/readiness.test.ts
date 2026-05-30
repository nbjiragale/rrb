import { test } from "node:test";
import assert from "node:assert/strict";
import { computeReadiness, type ReadinessInputs } from "./readiness.ts";

const base = (over: Partial<ReadinessInputs> = {}): ReadinessInputs => ({
  totalMarks: 100,
  concepts: [
    { pKnown: 0.8, examWeight: 1, attempted: true },
    { pKnown: 0.8, examWeight: 1, attempted: true },
  ],
  mockScoreFractions: [],
  negRatio: 1 / 3,
  targetMarks: null,
  ...over,
});

test("the band always brackets the point estimate", () => {
  const r = computeReadiness(base());
  assert.ok(r.low <= r.expected && r.expected <= r.high);
});

test("thin evidence yields a wide, low-confidence band", () => {
  const r = computeReadiness(
    base({ concepts: [{ pKnown: 0.5, examWeight: 1, attempted: false }], mockScoreFractions: [] })
  );
  assert.equal(r.confidence, "low");
  assert.ok(r.high - r.low > 30, `expected wide band, got ${r.high - r.low}`);
});

test("more mocks narrow the band and raise confidence", () => {
  const few = computeReadiness(base({ mockScoreFractions: [0.6] }));
  const many = computeReadiness(base({ mockScoreFractions: [0.6, 0.62, 0.58, 0.61, 0.59, 0.6] }));
  assert.ok(many.high - many.low < few.high - few.low);
  assert.ok(many.evidence > few.evidence);
});

test("with many mocks the estimate leans toward the mock mean", () => {
  // Strong mastery (~+0.7 fraction) but consistently weak mocks (0.30 fraction).
  const r = computeReadiness(base({ mockScoreFractions: Array(12).fill(0.3) }));
  assert.ok(Math.abs(r.expected - 30) < Math.abs(r.expected - 70));
});

test("onTrack is conservative: true only when the low end clears the target", () => {
  const strong = computeReadiness(
    base({ mockScoreFractions: Array(10).fill(0.7), targetMarks: 50 })
  );
  assert.equal(strong.onTrack, true);

  // Expected (~66) clears the target, but the wide low end (~55) does not →
  // conservatively not on track.
  const risky = computeReadiness(base({ mockScoreFractions: [0.55], targetMarks: 60 }));
  assert.ok(risky.expected > 60 && risky.low < 60);
  assert.equal(risky.onTrack, false);
});

test("negative marking can push the worst-case band below zero but not past the floor", () => {
  const r = computeReadiness(
    base({ concepts: [{ pKnown: 0, examWeight: 1, attempted: false }], totalMarks: 100, negRatio: 1 / 3 })
  );
  assert.ok(r.low >= -100 / 3 - 1e-6);
});
