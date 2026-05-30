import { test } from "node:test";
import assert from "node:assert/strict";
import { masteryBucket, MASTERY_LABEL } from "./mastery.ts";

test("masteryBucket maps p_known onto the 0–4 token scale", () => {
  assert.equal(masteryBucket(0), 0);
  assert.equal(masteryBucket(0.05), 0);
  assert.equal(masteryBucket(0.2), 1);
  assert.equal(masteryBucket(0.45), 2);
  assert.equal(masteryBucket(0.7), 3);
  assert.equal(masteryBucket(0.9), 4);
});

test("bucket is monotonic across the unit interval", () => {
  let prev = -1;
  for (let p = 0; p <= 1.0001; p += 0.05) {
    const b = masteryBucket(p);
    assert.ok(b >= prev, `non-monotonic at ${p}`);
    prev = b;
  }
});

test("every bucket has a label", () => {
  for (const b of [0, 1, 2, 3, 4] as const) {
    assert.ok(MASTERY_LABEL[b].length > 0);
  }
});
