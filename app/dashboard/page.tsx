import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { ReadinessCard } from "@/components/dashboard/ReadinessCard";
import { MasteryHeatmap } from "@/components/dashboard/MasteryHeatmap";
import { CoverageBars } from "@/components/dashboard/CoverageBars";
import { StreakCounter } from "@/components/dashboard/StreakCounter";
import { TrendChart } from "@/components/dashboard/TrendChart";
import {
  getHeatmap,
  getCoverage,
  getReviewDays,
  getReadinessConcepts,
  getRecentMockFractions,
} from "@/lib/db/queries/insights";
import { getTopicTrends } from "@/lib/db/queries/snapshots";
import { getExamConfig } from "@/lib/db/queries/examConfig";
import { computeReadiness } from "@/lib/readiness";
import { computeStreak } from "@/lib/streak";

export const dynamic = "force-dynamic";

// Epic J — insights dashboard: readiness, heatmap, trends, coverage, streak.
export default async function DashboardPage() {
  const [heatmap, coverage, reviewDays, rcConcepts, mockFractions, trends, config] =
    await Promise.all([
      getHeatmap(),
      getCoverage(),
      getReviewDays(),
      getReadinessConcepts(),
      getRecentMockFractions(5),
      getTopicTrends(8),
      getExamConfig(),
    ]);

  const sectionMarks = config?.sections?.reduce((sum, s) => sum + s.marks, 0) ?? 0;
  const totalMarks = sectionMarks > 0 ? sectionMarks : 100;
  const negRatio = config?.negative_mark_ratio ?? 1 / 3;
  // Target = a conventional ~45% qualifying band if not otherwise specified.
  const targetMarks = Math.round(totalMarks * 0.45);

  const readiness = computeReadiness({
    totalMarks,
    concepts: rcConcepts.map((c) => ({
      pKnown: c.p_known,
      examWeight: c.exam_weight,
      attempted: c.attempted,
    })),
    mockScoreFractions: mockFractions,
    negRatio,
    targetMarks,
  });

  const today = new Date().toISOString().slice(0, 10);
  const streak = computeStreak(reviewDays, today);

  const hasData = heatmap.length > 0;

  return (
    <>
      <PageHeader
        title="Dashboard"
        chips={
          hasData ? (
            <>
              <Badge tone={readiness.onTrack ? "success" : "neutral"}>
                {Math.round(readiness.expected)} / {totalMarks}
              </Badge>
              <Badge>{streak.current} day streak</Badge>
            </>
          ) : undefined
        }
      />
      <div className="mx-auto max-w-shell px-6 py-8 md:px-8">
        {!hasData ? (
          <Card className="p-6">
            <p className="text-body-lg text-secondary">
              Add concepts and start practising — your insights appear here as data accrues.
            </p>
          </Card>
        ) : (
          <div className="grid gap-6">
          <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
            <ReadinessCard readiness={readiness} totalMarks={totalMarks} targetMarks={targetMarks} />
            <StreakCounter streak={streak} />
          </div>

          <TrendChart points={trends} />

          <Card className="p-6">
            <h2 className="text-h3 mb-4">Mastery heatmap</h2>
            <MasteryHeatmap cells={heatmap} />
          </Card>

            <CoverageBars rows={coverage} />
          </div>
        )}
      </div>
    </>
  );
}
