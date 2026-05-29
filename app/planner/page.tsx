import { getLatestPlan } from "@/lib/db/queries/studyPlan";
import { listConcepts } from "@/lib/db/queries/concepts";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { generatePlan } from "./actions";

export const dynamic = "force-dynamic";

export default async function PlannerPage() {
  const [plan, concepts] = await Promise.all([getLatestPlan(), listConcepts()]);
  const nameById = new Map(concepts.map((c) => [c.id, c.name]));

  return (
    <div className="mx-auto max-w-column px-6 py-8 md:px-8">
      <h1 className="text-h1 mb-2">Study plan</h1>
      <p className="text-secondary text-body mb-6">
        What to learn next, by priority — high-yield, weak concepts first, respecting prerequisites.
      </p>

      <div className="mb-8 flex flex-wrap gap-3">
        <form action={generatePlan}>
          <input type="hidden" name="lowEnergy" value="0" />
          <Button type="submit">Generate today&apos;s plan</Button>
        </form>
        <form action={generatePlan}>
          <input type="hidden" name="lowEnergy" value="1" />
          <Button type="submit" variant="secondary">
            Low-energy day
          </Button>
        </form>
      </div>

      {!plan ? (
        <p className="text-secondary text-body-lg">No plan yet. Generate one above.</p>
      ) : (
        <div className="grid gap-4">
          <Card className="p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-caption uppercase tracking-[0.02em] text-muted">{plan.plan_date}</p>
              <p className="text-body-lg">{plan.capacity_note}</p>
            </div>
            <Badge tone="accent">{plan.review_load ?? 0} reviews</Badge>
          </Card>

          {plan.new_concepts.length === 0 ? (
            <p className="text-secondary text-body">No new concepts today — focus on reviews.</p>
          ) : (
            <Card className="p-2">
              {plan.new_concepts.map((c) => (
                <div
                  key={c.concept_id}
                  className="flex items-start gap-4 rounded-md p-3 hover:bg-hover"
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-caption text-accent-strong">
                    {c.order}
                  </span>
                  <div className="min-w-0">
                    <p className="text-body font-medium">
                      {nameById.get(c.concept_id) ?? `Concept #${c.concept_id}`}
                    </p>
                    <p className="text-small text-muted">{c.reason}</p>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
