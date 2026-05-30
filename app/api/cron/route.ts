import { NextResponse } from "next/server";
import { recomputePyqStats } from "@/lib/services/pyqStats";
import { generateTodayPlan } from "@/lib/services/planner";
import { diagnosePending } from "@/lib/services/diagnosis";
import { refitCalibration } from "@/lib/services/calibration";
import { regenerateProfile } from "@/lib/services/profile";
import { backfillEmbeddings } from "@/lib/services/embeddings";
import { summarizePendingCa } from "@/lib/services/currentAffairs";
import { recordDailySnapshots } from "@/lib/services/snapshots";

export const dynamic = "force-dynamic";

// Nightly batch (architecture §9 step 5 / walkthrough C), triggered by cron.
// v3: PYQ stats → exam_weight, then today's plan.
// v4: diagnose undiagnosed wrong attempts.
// v5: backfill embeddings, refit calibration, summarise CA, regenerate profile.
// v6: record the daily mastery snapshot (trends). Runs after diagnosis/calibration
// so it captures the freshest mastery state.
// Order matters: profile reads calibration + freshly-diagnosed misconceptions.
// Protected by CRON_SECRET when set.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const stats = await recomputePyqStats();
  const diagnosis = await diagnosePending();
  const embeddings = await backfillEmbeddings();
  const calibration = await refitCalibration();
  const caSummaries = await summarizePendingCa();
  const snapshots = await recordDailySnapshots();
  const profile = await regenerateProfile();
  const plan = await generateTodayPlan({ lowEnergy: false });

  return NextResponse.json({
    ok: true,
    examWeightUpdatedFor: stats.concepts,
    attemptsDiagnosed: diagnosis.diagnosed,
    embeddingsBackfilled: embeddings.embedded,
    calibrationFitted: calibration.fitted,
    calibrationConceptsUpdated: calibration.conceptsUpdated,
    caSummarized: caSummaries.summarized,
    snapshotsBackfilled: snapshots.backfilled,
    snapshotsToday: snapshots.today,
    profileRegenerated: Boolean(profile),
    planDate: plan.plan_date,
    newConcepts: plan.new_concepts.length,
  });
}
