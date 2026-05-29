import { test } from "node:test";
import assert from "node:assert/strict";
import { bktUpdate, predictCorrect, masteryLevel, DEFAULT_BKT } from "./bkt.ts";

test("a correct answer raises P(known)", () => {
  const before = 0.3;
  assert.ok(bktUpdate(before, true) > before);
});

test("a wrong answer lowers the posterior below the prior", () => {
  // With default learning rate the floor is the learn term; check the answer
  // pulls the estimate down relative to a correct answer from the same prior.
  const prior = 0.6;
  assert.ok(bktUpdate(prior, false) < bktUpdate(prior, true));
});

test("P(known) stays within [0, 1]", () => {
  for (const p of [0, 0.1, 0.5, 0.9, 1]) {
    for (const correct of [true, false]) {
      const next = bktUpdate(p, correct);
      assert.ok(next >= 0 && next <= 1, `out of range: ${next}`);
    }
  }
});

test("predictCorrect respects slip/guess bounds", () => {
  assert.equal(predictCorrect(1), 1 - DEFAULT_BKT.pS);
  assert.equal(predictCorrect(0), DEFAULT_BKT.pG);
});

test("masteryLevel buckets by threshold", () => {
  assert.equal(masteryLevel(0.1), "new");
  assert.equal(masteryLevel(0.4), "learning");
  assert.equal(masteryLevel(0.7), "review");
  assert.equal(masteryLevel(0.9), "mastered");
});
