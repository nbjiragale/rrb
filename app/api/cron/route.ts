import { NextResponse } from "next/server";
import { recomputePyqStats } from "@/lib/services/pyqStats";
import { generateTodayPlan } from "@/lib/services/planner";
import { diagnosePending } from "@/lib/services/diagnosis";
import { refitCalibration } from "@/lib/services/calibration";
import { regenerateProfile } from "@/lib/services/profile";
import { backfillEmbeddings } from "@/lib/services/embeddings";
import { summarizePendingCa, autoGenerateCaCards } from "@/lib/services/currentAffairs";
import { autoReplenishQuestions } from "@/lib/services/generation";
import { ingestFromSources } from "@/lib/services/caScraper";
import { ingestFromGemini } from "@/lib/services/caGemini";
import { recordDailySnapshots } from "@/lib/services/snapshots";
import { checkBearer } from "@/lib/http/auth";

export const dynamic = "force-dynamic";

// Nightly batch (architecture §9 step 5 / walkthrough C), triggered by cron.
// v3: PYQ stats → exam_weight, then today's plan.
// v4: diagnose undiagnosed wrong attempts.
// v5: backfill embeddings, refit calibration, summarise CA, regenerate profile.
// v6: record the daily mastery snapshot (trends).
// P1: auto-generate grounded CA cards (scrape→study loop) and replenish verified
//     practice questions for weak concepts — both bounded for cost (Hard Rule §4).
//
// Every step is isolated: a failure is recorded and the batch continues, so one
// flaky LLM call can't starve later steps (notably the plan, which runs last).
// Order still matters for freshness — profile reads calibration + diagnoses.
// Requires CRON_SECRET (fails closed when unset — Vercel Cron sends it as the
// Authorization bearer automatically). This endpoint runs billed LLM jobs.
export async function GET(req: Request) {
  const auth = checkBearer(req, "CRON_SECRET");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 401 });
  }

  const errors: { step: string; message: string }[] = [];
  async function safe<T>(step: string, fn: () => Promise<T>): Promise<T | null> {
    try {
      return await fn();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`cron step "${step}" failed:`, message);
      errors.push({ step, message });
      return null;
    }
  }

  const stats = await safe("pyqStats", () => recomputePyqStats());
  const diagnosis = await safe("diagnose", () => diagnosePending());
  const embeddings = await safe("embeddings", () => backfillEmbeddings());
  const calibration = await safe("calibration", () => refitCalibration());
  // Ingest fresh CA before summarising/generating so new items get a digest
  // summary and grounded cards in the same nightly run. CA_INGEST_PROVIDER picks
  // the strategy: "gemini" fetches via grounded Google Search, otherwise the
  // Firecrawl scraper (default — no behaviour change unless opted in).
  const caIngest =
    process.env.CA_INGEST_PROVIDER === "gemini" ? ingestFromGemini : ingestFromSources;
  const caScrape = await safe("caScrape", () => caIngest());
  const caSummaries = await safe("caSummaries", () => summarizePendingCa());
  const caCards = await safe("caCards", () => autoGenerateCaCards());
  const replenish = await safe("replenishQuestions", () => autoReplenishQuestions());
  const snapshots = await safe("snapshots", () => recordDailySnapshots());
  const profile = await safe("profile", () => regenerateProfile());
  const plan = await safe("plan", () => generateTodayPlan({ lowEnergy: false }));

  return NextResponse.json({
    ok: errors.length === 0,
    errors,
    examWeightUpdatedFor: stats?.concepts ?? 0,
    attemptsDiagnosed: diagnosis?.diagnosed ?? 0,
    embeddingsBackfilled: embeddings?.embedded ?? 0,
    calibrationFitted: calibration?.fitted ?? false,
    calibrationConceptsUpdated: calibration?.conceptsUpdated ?? 0,
    caScraped: caScrape?.scraped ?? 0,
    caIngested: caScrape?.ingested ?? 0,
    caSkippedDuplicates: caScrape?.skippedDuplicates ?? 0,
    caDroppedUngrounded: caScrape?.droppedUngrounded ?? 0,
    caScrapeErrors: caScrape?.errors.length ?? 0,
    caSummarized: caSummaries?.summarized ?? 0,
    caCardsItems: caCards?.items ?? 0,
    caCardsCreated: caCards?.cards ?? 0,
    questionsReplenishedConcepts: replenish?.concepts ?? 0,
    questionsGenerated: replenish?.generated ?? 0,
    questionsVerified: replenish?.verified ?? 0,
    snapshotsBackfilled: snapshots?.backfilled ?? 0,
    snapshotsToday: snapshots?.today ?? 0,
    profileRegenerated: Boolean(profile),
    planDate: plan?.plan_date ?? null,
    newConcepts: plan?.new_concepts.length ?? 0,
  });
}
