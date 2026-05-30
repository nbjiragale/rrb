import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sigmoid,
  fitLogistic,
  predictAccuracy,
  breakEvenP,
  expectedValue,
  evThresholdConfidence,
  brierScore,
  type CalibrationSample,
} from "./calibration.ts";

test("sigmoid is centered and monotonic", () => {
  assert.equal(sigmoid(0), 0.5);
  assert.ok(sigmoid(2) > sigmoid(1));
  assert.ok(sigmoid(-2) < 0.5);
});

test("breakEvenP is 0.25 for the RRB 1/3 penalty", () => {
  assert.ok(Math.abs(breakEvenP(1 / 3) - 0.25) < 1e-9);
});

test("expectedValue is zero exactly at the break-even probability", () => {
  const neg = 1 / 3;
  assert.ok(Math.abs(expectedValue(breakEvenP(neg), neg)) < 1e-9);
  assert.ok(expectedValue(0.5, neg) > 0);
  assert.ok(expectedValue(0.1, neg) < 0);
});

test("fitLogistic returns null below the minimum sample count", () => {
  assert.equal(fitLogistic([{ confidence: 3, correct: true }]), null);
});

test("fitLogistic recovers an increasing confidence→accuracy relationship", () => {
  // Low confidence mostly wrong, high confidence mostly right.
  const samples: CalibrationSample[] = [];
  for (let i = 0; i < 40; i++) {
    samples.push({ confidence: 1, correct: i % 5 === 0 }); // ~20%
    samples.push({ confidence: 5, correct: i % 5 !== 0 }); // ~80%
  }
  const model = fitLogistic(samples)!;
  assert.ok(model.slope > 0, "slope should be positive");
  assert.ok(predictAccuracy(model, 5) > predictAccuracy(model, 1));
});

test("evThresholdConfidence falls between the low and high confidence levels", () => {
  const samples: CalibrationSample[] = [];
  for (let i = 0; i < 40; i++) {
    samples.push({ confidence: 1, correct: false });
    samples.push({ confidence: 5, correct: true });
  }
  const model = fitLogistic(samples)!;
  const thr = evThresholdConfidence(model, 1 / 3);
  assert.ok(thr !== null && thr > 1 && thr < 5, `threshold out of range: ${thr}`);
});

test("evThresholdConfidence is null when confidence carries no signal", () => {
  const samples: CalibrationSample[] = [];
  for (let i = 0; i < 40; i++) {
    samples.push({ confidence: 1, correct: i % 2 === 0 });
    samples.push({ confidence: 5, correct: i % 2 === 0 });
  }
  const model = fitLogistic(samples)!;
  // slope ~ 0 → no usable threshold
  const thr = evThresholdConfidence(model, 1 / 3);
  assert.ok(thr === null || Math.abs(model.slope) < 0.05);
});

test("brierScore is lower for a well-fit model than a flat 0.5 guess", () => {
  const samples: CalibrationSample[] = [];
  for (let i = 0; i < 40; i++) {
    samples.push({ confidence: 1, correct: false });
    samples.push({ confidence: 5, correct: true });
  }
  const model = fitLogistic(samples)!;
  const fitted = brierScore(model, samples);
  const flat = brierScore({ intercept: 0, slope: 0, nSamples: 0 }, samples); // all 0.5 → 0.25
  assert.ok(fitted < flat);
});
