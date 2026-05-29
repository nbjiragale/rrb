import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkStructure,
  judgeMath,
  judgeGa,
  selectGroundedCards,
  type GeneratedQuestion,
} from "./questionChecks.ts";

const valid: GeneratedQuestion = {
  stem: "2 + 2 = ?",
  options: ["3", "4", "5", "22"],
  correct_option: 1,
  explanation: "basic addition",
};

test("checkStructure accepts a well-formed question", () => {
  assert.equal(checkStructure(valid).ok, true);
});

test("checkStructure rejects the wrong number of options", () => {
  assert.equal(checkStructure({ ...valid, options: ["3", "4", "5"] }).ok, false);
});

test("checkStructure rejects duplicate options", () => {
  assert.equal(checkStructure({ ...valid, options: ["4", "4", "5", "6"] }).ok, false);
});

test("checkStructure rejects an empty option", () => {
  assert.equal(checkStructure({ ...valid, options: ["4", " ", "5", "6"] }).ok, false);
});

test("checkStructure rejects an out-of-range correct_option", () => {
  assert.equal(checkStructure({ ...valid, correct_option: 4 }).ok, false);
  assert.equal(checkStructure({ ...valid, correct_option: -1 }).ok, false);
});

test("checkStructure rejects an empty stem", () => {
  assert.equal(checkStructure({ ...valid, stem: "  " }).ok, false);
});

test("judgeMath passes when the independent solve agrees, is unique and solvable", () => {
  const r = judgeMath(valid, { correct_option: 1, unique: true, solvable: true });
  assert.equal(r.ok, true);
});

test("judgeMath rejects an answer mismatch", () => {
  const r = judgeMath(valid, { correct_option: 2, unique: true, solvable: true });
  assert.equal(r.ok, false);
  assert.match(r.reason, /mismatch/);
});

test("judgeMath rejects a non-unique or unsolvable item", () => {
  assert.equal(judgeMath(valid, { correct_option: 1, unique: false, solvable: true }).ok, false);
  assert.equal(judgeMath(valid, { correct_option: 1, unique: true, solvable: false }).ok, false);
});

test("judgeGa passes only when grounded and the source-supported answer matches", () => {
  const src = "The capital of France is Paris.";
  assert.equal(
    judgeGa(valid, src, { all_grounded: true, correct_option: 1 }).ok,
    true
  );
});

test("judgeGa rejects when a fact is not grounded in the source", () => {
  const r = judgeGa(valid, "some source", { all_grounded: false, correct_option: 1 });
  assert.equal(r.ok, false);
  assert.match(r.reason, /trace to the source/);
});

test("judgeGa rejects when the source supports a different answer", () => {
  const r = judgeGa(valid, "some source", { all_grounded: true, correct_option: 0 });
  assert.equal(r.ok, false);
});

test("judgeGa refuses without source text (ungrounded GA blocked)", () => {
  assert.equal(judgeGa(valid, "", { all_grounded: true, correct_option: 1 }).ok, false);
});

test("selectGroundedCards keeps only grounded, non-empty cards in order", () => {
  const cards = [
    { front: "a", back: "1" },
    { front: "b", back: "2" },
    { front: "c", back: "3" },
  ];
  const kept = selectGroundedCards(cards, [true, false, true]);
  assert.deepEqual(kept, [
    { front: "a", back: "1" },
    { front: "c", back: "3" },
  ]);
});
