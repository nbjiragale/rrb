import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONCEPTS,
  CONTRASTS,
  EXAM_PATTERN,
  PREREQUISITES,
  SYLLABUS_LINES,
  conceptsForLine,
  uncoveredSyllabusLines,
} from "./syllabus.ts";

test("every published syllabus line is covered by at least one concept", () => {
  const uncovered = uncoveredSyllabusLines();
  assert.deepEqual(
    uncovered.map((l) => l.id),
    [],
    `uncovered syllabus lines: ${uncovered.map((l) => l.title).join(", ")}`
  );
});

test("every concept claims at least one syllabus line, in its own subject", () => {
  const subjectById = new Map(SYLLABUS_LINES.map((l) => [l.id as string, l.subject as string]));
  for (const c of CONCEPTS) {
    assert.ok(c.syllabus.length > 0, `${c.name} claims no syllabus line`);
    for (const id of c.syllabus) {
      assert.equal(
        subjectById.get(id),
        c.subject,
        `${c.name} (${c.subject}) claims ${id}, which belongs to another subject`
      );
    }
  }
});

test("concept names are unique — edges resolve by name", () => {
  const seen = new Set<string>();
  for (const c of CONCEPTS) {
    assert.ok(!seen.has(c.name), `duplicate concept name: ${c.name}`);
    seen.add(c.name);
  }
});

test("every edge references a known concept and is not a self-loop", () => {
  const names = new Set(CONCEPTS.map((c) => c.name));
  for (const [a, b] of [...PREREQUISITES, ...CONTRASTS]) {
    assert.ok(names.has(a), `edge references unknown concept: ${a}`);
    assert.ok(names.has(b), `edge references unknown concept: ${b}`);
    assert.notEqual(a, b, `self-loop on ${a}`);
  }
});

test("the prerequisite graph is acyclic — a cycle would deadlock the planner", () => {
  const foundations = new Map<string, string[]>();
  for (const [dependent, foundation] of PREREQUISITES) {
    foundations.set(dependent, [...(foundations.get(dependent) ?? []), foundation]);
  }
  const state = new Map<string, "visiting" | "done">();
  const walk = (node: string, path: string[]) => {
    if (state.get(node) === "done") return;
    assert.notEqual(state.get(node), "visiting", `prerequisite cycle: ${[...path, node].join(" → ")}`);
    state.set(node, "visiting");
    for (const next of foundations.get(node) ?? []) walk(next, [...path, node]);
    state.set(node, "done");
  };
  for (const node of foundations.keys()) walk(node, []);
});

test("exam pattern matches the graduate-level paper", () => {
  const total = (stage: keyof typeof EXAM_PATTERN, field: "questions" | "marks") =>
    EXAM_PATTERN[stage].sections.reduce((sum, s) => sum + s[field], 0);
  assert.equal(total("cbt1", "questions"), 100);
  assert.equal(total("cbt1", "marks"), 100);
  assert.equal(total("cbt2", "questions"), 120);
  assert.equal(total("cbt2", "marks"), 120);
});

test("conceptsForLine returns the concepts behind a line", () => {
  const names = conceptsForLine("math.interest").map((c) => c.name);
  assert.deepEqual(names, ["Simple Interest", "Compound Interest"]);
  assert.equal(conceptsForLine("ga.computers").length > 0, true);
});
