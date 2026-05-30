import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStreak } from "./streak.ts";

test("empty history is a zero streak", () => {
  assert.deepEqual(computeStreak([], "2026-05-30"), { current: 0, longest: 0, studiedToday: false });
});

test("consecutive days ending today count as a live current streak", () => {
  const r = computeStreak(["2026-05-28", "2026-05-29", "2026-05-30"], "2026-05-30");
  assert.equal(r.current, 3);
  assert.equal(r.studiedToday, true);
});

test("a streak through yesterday is preserved before today's study", () => {
  const r = computeStreak(["2026-05-28", "2026-05-29"], "2026-05-30");
  assert.equal(r.current, 2);
  assert.equal(r.studiedToday, false);
});

test("a gap of two or more days breaks the current streak", () => {
  const r = computeStreak(["2026-05-25", "2026-05-26"], "2026-05-30");
  assert.equal(r.current, 0);
});

test("longest captures the best historical run, not the current one", () => {
  const r = computeStreak(
    ["2026-05-01", "2026-05-02", "2026-05-03", "2026-05-20", "2026-05-30"],
    "2026-05-30"
  );
  assert.equal(r.longest, 3);
  assert.equal(r.current, 1);
});

test("duplicate dates are de-duplicated", () => {
  const r = computeStreak(["2026-05-30", "2026-05-30", "2026-05-29"], "2026-05-30");
  assert.equal(r.current, 2);
});
