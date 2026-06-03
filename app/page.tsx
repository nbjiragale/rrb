import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/LinkButton";
import { ListRow } from "@/components/ui/ListRow";
import { PageHeader } from "@/components/ui/PageHeader";
import { countDue } from "@/lib/db/queries/cards";
import { getLatestPlan } from "@/lib/db/queries/studyPlan";
import { listConcepts } from "@/lib/db/queries/concepts";
import { getReviewDays, getReadinessConcepts, getRecentMockFractions } from "@/lib/db/queries/insights";
import { getExamConfig } from "@/lib/db/queries/examConfig";
import { computeReadiness } from "@/lib/readiness";
import { computeStreak } from "@/lib/streak";
import { NEW_CARD_CAP } from "@/lib/config";

export const dynamic = "force-dynamic";

// Today — the command surface (UIredesignspec §10.1). Answers "what do I do now,
// and am I on track" in one glance: due work + a primary CTA, today's plan,
// standing, and streak. Replaces the old "/" → "/review" redirect.
export default async function TodayPage() {
  const [{ due, newCount }, plan, concepts, reviewDays, rcConcepts, mockFractions, config] =
    await Promise.all([
      countDue(),
      getLatestPlan(),
      listConcepts(),
      getReviewDays(),
      getReadinessConcepts(),
      getRecentMockFractions(5),
      getExamConfig(),
    ]);

  // Fresh install — no material yet. Onboard instead of showing zeros.
  if (concepts.length === 0) {
    return (
      <>
        <PageHeader title="Today" />
        <div className="mx-auto max-w-shell px-6 py-8 md:px-8">
          <Card className="p-8">
            <h2 className="text-h2 mb-2">Let&apos;s set up your material</h2>
            <p className="mb-6 max-w-read text-body-lg text-secondary">
              Add concepts and a few cards to begin. Your daily review, plan, and readiness all grow
              from here.
            </p>
            <div className="flex flex-wrap gap-3">
              <LinkButton href="/concepts">Add concepts</LinkButton>
              <LinkButton href="/ingest" variant="secondary">
                Ingest content
              </LinkButton>
            </div>
          </Card>
        </div>
      </>
    );
  }

  const newToday = Math.min(newCount, NEW_CARD_CAP);
  const queued = due + newToday;
  const estMinutes = Math.max(1, Math.round(queued * 0.4));

  const nameById = new Map(concepts.map((c) => [c.id, c.name]));
  const planConcepts = plan?.new_concepts.slice(0, 3) ?? [];

  const sectionMarks = config?.sections?.reduce((sum, s) => sum + s.marks, 0) ?? 0;
  const totalMarks = sectionMarks > 0 ? sectionMarks : 100;
  const targetMarks = Math.round(totalMarks * 0.45);
  const readiness = computeReadiness({
    totalMarks,
    concepts: rcConcepts.map((c) => ({
      pKnown: c.p_known,
      examWeight: c.exam_weight,
      attempted: c.attempted,
    })),
    mockScoreFractions: mockFractions,
    negRatio: config?.negative_mark_ratio ?? 1 / 3,
    targetMarks,
  });

  const today = new Date().toISOString().slice(0, 10);
  const streak = computeStreak(reviewDays, today);

  return (
    <>
      <PageHeader
        title="Today"
        chips={
          <>
            {due > 0 && <Badge tone="accent">{due} due</Badge>}
            {newToday > 0 && <Badge>{newToday} new</Badge>}
          </>
        }
      />

      <div className="mx-auto max-w-shell px-6 py-8 md:px-8">
        <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
          {/* Hero — the next action */}
          <Card className="p-8 md:row-span-2">
            <p className="text-caption uppercase tracking-[0.02em] text-muted">{greeting()}</p>
            {queued > 0 ? (
              <>
                <h2 className="mt-2 text-h1">
                  {due > 0 ? `${due} reviews due` : `${newToday} new to learn`}
                </h2>
                <p className="mt-2 text-body-lg text-secondary">
                  {[
                    due > 0 ? `${due} review${due === 1 ? "" : "s"}` : null,
                    newToday > 0 ? `${newToday} new` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}{" "}
                  · <span className="font-mono">~{estMinutes} min</span>
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <LinkButton href="/review">
                    Start review <ArrowRight size={16} strokeWidth={2} className="ml-1.5" />
                  </LinkButton>
                  <LinkButton href="/practice" variant="secondary">
                    Practice
                  </LinkButton>
                </div>
              </>
            ) : (
              <>
                <h2 className="mt-2 text-h1">All caught up</h2>
                <p className="mt-2 text-body-lg text-secondary">
                  No reviews due right now. Drill some questions to stay sharp.
                </p>
                <div className="mt-6">
                  <LinkButton href="/practice">Practice</LinkButton>
                </div>
              </>
            )}
          </Card>

          {/* Readiness */}
          <Card className="p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-h3">Readiness</h2>
              <Badge tone={readiness.onTrack ? "success" : "neutral"}>
                {readiness.confidence}
              </Badge>
            </div>
            <p className="font-mono text-display leading-none text-primary">
              {Math.round(readiness.expected)}
              <span className="text-h3 text-muted"> / {totalMarks}</span>
            </p>
            <p className="mt-2 text-small text-muted">
              Range {Math.round(readiness.low)}–{Math.round(readiness.high)} · target {targetMarks}
            </p>
            <LinkButton href="/dashboard" variant="ghost" className="mt-3 -ml-3">
              View dashboard <ArrowRight size={14} strokeWidth={2} className="ml-1" />
            </LinkButton>
          </Card>

          {/* Streak */}
          <Card className="p-6">
            <h2 className="mb-3 text-h3">Streak</h2>
            <p className="font-mono text-display leading-none text-primary">
              {streak.current}
              <span className="text-h3 text-muted"> day{streak.current === 1 ? "" : "s"}</span>
            </p>
            <p className="mt-2 text-small text-muted">
              {streak.studiedToday ? "Studied today" : "Review to keep it going"} · best{" "}
              {streak.longest}
            </p>
          </Card>
        </div>

        {/* Today's plan */}
        <Card className="mt-6 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3.5">
            <h2 className="text-h3">Today&apos;s plan</h2>
            <LinkButton href="/planner" variant="ghost" className="-mr-3">
              Open planner
            </LinkButton>
          </div>
          {planConcepts.length === 0 ? (
            <p className="border-t border-border-subtle px-4 py-6 text-body text-muted">
              No plan yet — generate one in the planner to see what to learn next.
            </p>
          ) : (
            <div className="border-t border-border-subtle">
              {planConcepts.map((c) => (
                <ListRow
                  key={c.concept_id}
                  href="/planner"
                  leading={
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-subtle text-caption text-accent-strong">
                      {c.order}
                    </span>
                  }
                  title={nameById.get(c.concept_id) ?? `Concept #${c.concept_id}`}
                  subtitle={c.reason}
                />
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
