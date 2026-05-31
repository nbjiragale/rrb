import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPlan, type PlannerConcept } from "./planner.ts";

const base = (over: Partial<PlannerConcept> & { id: number }): PlannerConcept => ({
  examWeight: 1,
  pKnown: 0.1,
  prerequisiteIds: [],
  ...over,
});

test("low-energy day yields reviews only", () => {
  const plan = buildPlan({
    concepts: [base({ id: 1 })],
    reviewLoad: 10,
    dailyCapacity: 30,
    lowEnergy: true,
    daysToExam: null,
  });
  assert.equal(plan.newConcepts.length, 0);
  assert.match(plan.capacityNote, /reviews only/i);
});

test("exam-date backstop stops new intake", () => {
  const plan = buildPlan({
    concepts: [base({ id: 1 })],
    reviewLoad: 5,
    dailyCapacity: 30,
    lowEnergy: false,
    daysToExam: 10,
  });
  assert.equal(plan.newConcepts.length, 0);
});

test("a past exam date does not suppress new intake", () => {
  const plan = buildPlan({
    concepts: [base({ id: 1 })],
    reviewLoad: 5,
    dailyCapacity: 30,
    lowEnergy: false,
    daysToExam: -7, // stale config: exam already passed
  });
  assert.equal(plan.newConcepts.length, 1, "negative daysToExam must not trigger the backstop");
});

test("empty-state note names the cause", () => {
  const noOntology = buildPlan({
    concepts: [],
    reviewLoad: 0,
    dailyCapacity: 30,
    lowEnergy: false,
    daysToExam: null,
  });
  assert.match(noOntology.capacityNote, /ontology/i);

  const blocked = buildPlan({
    concepts: [base({ id: 1, pKnown: 0.1, prerequisiteIds: [99] })], // prereq absent → 0.1, not owned
    reviewLoad: 0,
    dailyCapacity: 30,
    lowEnergy: false,
    daysToExam: null,
  });
  assert.equal(blocked.newConcepts.length, 0);
  assert.match(blocked.capacityNote, /prerequisite/i);

  const allMastered = buildPlan({
    concepts: [base({ id: 1, pKnown: 0.9 })],
    reviewLoad: 0,
    dailyCapacity: 30,
    lowEnergy: false,
    daysToExam: null,
  });
  assert.match(allMastered.capacityNote, /mastery threshold/i);
});

test("respects prerequisites (I2)", () => {
  const concepts = [
    base({ id: 1, pKnown: 0.5 }), // prereq not yet owned (<0.7)
    base({ id: 2, pKnown: 0.1, prerequisiteIds: [1] }),
  ];
  const plan = buildPlan({ concepts, reviewLoad: 0, dailyCapacity: 30, lowEnergy: false, daysToExam: null });
  const ids = plan.newConcepts.map((c) => c.concept_id);
  assert.ok(!ids.includes(2), "concept 2 is gated by its unmet prerequisite");
  assert.ok(ids.includes(1), "concept 1 is itself learnable");
});

test("orders by exam_weight × (1 − p_known)", () => {
  const concepts = [
    base({ id: 1, examWeight: 1, pKnown: 0.1 }), // 0.9
    base({ id: 2, examWeight: 3, pKnown: 0.1 }), // 2.7 ← highest
    base({ id: 3, examWeight: 1, pKnown: 0.5 }), // 0.5
  ];
  const plan = buildPlan({ concepts, reviewLoad: 0, dailyCapacity: 30, lowEnergy: false, daysToExam: null });
  assert.equal(plan.newConcepts[0].concept_id, 2);
});

test("intake cap leaves room for reviews (I4)", () => {
  const concepts = Array.from({ length: 10 }, (_, i) => base({ id: i + 1 }));
  const plan = buildPlan({ concepts, reviewLoad: 28, dailyCapacity: 30, lowEnergy: false, daysToExam: null });
  assert.equal(plan.newConcepts.length, 2); // 30 − 28
});
