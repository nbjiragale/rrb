import { NextResponse } from "next/server";
import { recomputePyqStats } from "@/lib/services/pyqStats";
import { generateTodayPlan } from "@/lib/services/planner";
import { diagnosePending } from "@/lib/services/diagnosis";

export const dynamic = "force-dynamic";

// Nightly batch (architecture §9, step 5), triggered by cron (e.g. Vercel Cron).
// v3: recompute PYQ stats → exam_weight, then generate today's plan.
// v4: sweep any undiagnosed wrong attempts (the interactive path may miss mock
// answers). Later phases add profile regeneration, calibration refit, etc.
// Protected by CRON_SECRET when set.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const stats = await recomputePyqStats();
  const diagnosis = await diagnosePending();
  const plan = await generateTodayPlan({ lowEnergy: false });

  return NextResponse.json({
    ok: true,
    examWeightUpdatedFor: stats.concepts,
    attemptsDiagnosed: diagnosis.diagnosed,
    planDate: plan.plan_date,
    newConcepts: plan.new_concepts.length,
  });
}
