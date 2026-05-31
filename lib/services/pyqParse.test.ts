import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePyqBatch } from "./pyqParse.ts";

const valid = {
  concept: "Percentages",
  stem: "What is 15% of 240?",
  options: ["30", "36", "40", "45"],
  correct_option: 1,
};

test("parses a valid array batch", () => {
  const { rows, errors } = parsePyqBatch(JSON.stringify([valid]));
  assert.equal(errors.length, 0);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].concept, "Percentages");
});

test("accepts a { questions: [...] } envelope", () => {
  const { rows, errors } = parsePyqBatch(JSON.stringify({ questions: [valid] }));
  assert.equal(errors.length, 0);
  assert.equal(rows.length, 1);
});

test("accepts a numeric concept id", () => {
  const { rows, errors } = parsePyqBatch(JSON.stringify([{ ...valid, concept: 7 }]));
  assert.equal(errors.length, 0);
  assert.equal(rows[0].concept, 7);
});

test("rejects invalid JSON with a single envelope error", () => {
  const { rows, errors } = parsePyqBatch("{not json");
  assert.equal(rows.length, 0);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].index, -1);
});

test("rejects a non-array, non-envelope payload", () => {
  const { errors } = parsePyqBatch(JSON.stringify({ foo: "bar" }));
  assert.equal(errors[0].index, -1);
});

test("flags an empty batch", () => {
  const { errors } = parsePyqBatch("[]");
  assert.equal(errors[0].index, -1);
});

test("reports per-row errors but keeps valid rows", () => {
  const batch = [
    valid,
    { ...valid, options: ["only", "three", "here"] }, // wrong length
    { ...valid, correct_option: 9 }, // out of range
    { stem: "missing concept", options: ["a", "b", "c", "d"], correct_option: 0 },
  ];
  const { rows, errors } = parsePyqBatch(JSON.stringify(batch));
  assert.equal(rows.length, 1);
  assert.equal(errors.length, 3);
  assert.deepEqual(errors.map((e) => e.index), [1, 2, 3]);
});

test("rejects unknown fields (strict)", () => {
  const { rows, errors } = parsePyqBatch(JSON.stringify([{ ...valid, junk: true }]));
  assert.equal(rows.length, 0);
  assert.equal(errors.length, 1);
});

test("coerces stringified numbers for correct_option / exam_year", () => {
  const { rows, errors } = parsePyqBatch(
    JSON.stringify([{ ...valid, correct_option: "2", exam_year: "2019" }])
  );
  assert.equal(errors.length, 0);
  assert.equal(rows[0].correct_option, 2);
  assert.equal(rows[0].exam_year, 2019);
});
