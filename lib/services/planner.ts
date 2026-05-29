import { buildPlan } from "@/lib/planner";
import { listConcepts } from "@/lib/db/queries/concepts";
import { listMastery } from "@/lib/db/queries/mastery";
import { getPrerequisiteMap } from "@/lib/db/queries/edges";
import { countDue } from "@/lib/db/queries/cards";
import { getExamConfig } from "@/lib/db/queries/examConfig";
import { savePlan, getLatestPlan } from "@/lib/db/queries/studyPlan";
import { DAILY_CAPACITY } from "@/lib/config";
import type { StudyPlan } from "@/lib/db/types";

const MS_PER_DAY = 86_400_000;

// I1 — generate today's plan: gather DB inputs, run the pure planner, persist.
export async function generateTodayPlan(opts: { lowEnergy: boolean }): Promise<StudyPlan> {
  const [concepts, mastery, prereqMap, due, exam] = await Promise.all([
    listConcepts(),
    listMastery(),
    getPrerequisiteMap(),
    countDue(),
    getExamConfig(),
  ]);

  const pKnownById = new Map(mastery.map((m) => [m.concept_id, m.p_known]));

  const plannerConcepts = concepts.map((c) => ({
    id: c.id,
    examWeight: c.exam_weight,
    pKnown: pKnownById.get(c.id) ?? 0.1,
    prerequisiteIds: prereqMap.get(c.id) ?? [],
  }));

  const daysToExam = exam?.exam_date
    ? Math.ceil((new Date(exam.exam_date).getTime() - Date.now()) / MS_PER_DAY)
    : null;

  const plan = buildPlan({
    concepts: plannerConcepts,
    reviewLoad: due.due,
    dailyCapacity: DAILY_CAPACITY,
    lowEnergy: opts.lowEnergy,
    daysToExam,
  });

  await savePlan({
    plan_date: new Date().toISOString().slice(0, 10),
    horizon: "day",
    new_concepts: plan.newConcepts,
    review_load: plan.reviewLoad,
    capacity_note: plan.capacityNote,
  });

  const saved = await getLatestPlan();
  if (!saved) throw new Error("Plan failed to persist");
  return saved;
}
