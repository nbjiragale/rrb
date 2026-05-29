import { query, queryOne } from "@/lib/db/client";
import type { PlanHorizon, PlannedConcept, StudyPlan } from "@/lib/db/types";

export async function getLatestPlan(): Promise<StudyPlan | null> {
  return queryOne<StudyPlan>(
    `SELECT * FROM study_plan ORDER BY plan_date DESC, generated_at DESC LIMIT 1`
  );
}

// One plan per date: replace if regenerated the same day.
export async function savePlan(input: {
  plan_date: string;
  horizon: PlanHorizon;
  new_concepts: PlannedConcept[];
  review_load: number;
  capacity_note: string;
}): Promise<void> {
  await query(`DELETE FROM study_plan WHERE plan_date = $1 AND horizon = $2`, [
    input.plan_date,
    input.horizon,
  ]);
  await query(
    `INSERT INTO study_plan (plan_date, horizon, new_concepts, review_load, capacity_note)
     VALUES ($1, $2, $3::jsonb, $4, $5)`,
    [
      input.plan_date,
      input.horizon,
      JSON.stringify(input.new_concepts),
      input.review_load,
      input.capacity_note,
    ]
  );
}
