import { test } from "node:test";
import assert from "node:assert/strict";
import { caExamProbability } from "./caRanking.ts";

test("known high-yield categories rank above the default", () => {
  assert.ok(caExamProbability("appointments") > 0.5);
  assert.ok(caExamProbability("schemes") > caExamProbability("books"));
});

test("unknown or missing category falls back to the neutral prior", () => {
  assert.equal(caExamProbability(null), 0.5);
  assert.equal(caExamProbability("gossip"), 0.5);
});

test("category match is case- and whitespace-insensitive", () => {
  assert.equal(caExamProbability("  Appointments "), caExamProbability("appointments"));
});
