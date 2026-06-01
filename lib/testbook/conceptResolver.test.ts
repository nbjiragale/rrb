import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTagResolver } from "./conceptResolver.ts";

const concepts = [
  { id: 1, name: "Profit and Loss", topic: "Commercial Math" },
  { id: 2, name: "Simple Interest", topic: "Commercial Math" },
  { id: 3, name: "Indian Polity", topic: "Polity" },
];

test("matches a tag to a concept by name (normalized)", () => {
  const resolve = buildTagResolver(concepts, []);
  assert.equal(resolve("Profit and Loss"), 1);
  assert.equal(resolve("  PROFIT  and loss "), 1); // case/spacing-insensitive
});

test("matches by topic when it points to a single concept", () => {
  const resolve = buildTagResolver(concepts, []);
  assert.equal(resolve("Polity"), 3);
});

test("an ambiguous topic stays unmapped rather than guessing", () => {
  const resolve = buildTagResolver(concepts, []);
  // "Commercial Math" is the topic of two concepts → ambiguous → null
  assert.equal(resolve("Commercial Math"), null);
});

test("unknown and null tags resolve to null", () => {
  const resolve = buildTagResolver(concepts, []);
  assert.equal(resolve("Astrophysics"), null);
  assert.equal(resolve(null), null);
});

test("an override wins, even over ambiguity", () => {
  const resolve = buildTagResolver(concepts, [{ tag: "Commercial Math", concept_id: 2 }]);
  assert.equal(resolve("commercial math"), 2);
});
