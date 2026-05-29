import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreMock, perQuestionMs } from "./scoring.ts";

test("negative marking: skips never penalized", () => {
  const s = scoreMock(
    [
      { selectedOption: 0, isCorrect: true },
      { selectedOption: 1, isCorrect: false },
      { selectedOption: null, isCorrect: false },
    ],
    1 / 3
  );
  assert.equal(s.correct, 1);
  assert.equal(s.wrong, 1);
  assert.equal(s.skipped, 1);
  assert.equal(s.attempted, 2);
  assert.ok(Math.abs(s.score - (1 - 1 / 3)) < 1e-9);
  assert.ok(Math.abs(s.accuracy - 0.5) < 1e-9);
});

test("all skipped scores zero with zero accuracy", () => {
  const s = scoreMock([{ selectedOption: null, isCorrect: false }], 1 / 3);
  assert.equal(s.score, 0);
  assert.equal(s.accuracy, 0);
});

test("perQuestionMs derives deltas from cumulative timing", () => {
  const deltas = perQuestionMs([
    { q: 1, cumulative_ms: 1000 },
    { q: 2, cumulative_ms: 2500 },
    { q: 3, cumulative_ms: 3000 },
  ]);
  assert.deepEqual(deltas, [1000, 1500, 500]);
});
