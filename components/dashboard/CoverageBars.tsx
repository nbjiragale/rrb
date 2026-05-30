import { Card } from "@/components/ui/Card";
import type { CoverageRow } from "@/lib/db/queries/insights";

// J5 — syllabus coverage by subject: seen / in-progress / mastered as a share
// of total concepts. A single stacked bar per subject.
export function CoverageBars({ rows }: { rows: CoverageRow[] }) {
  if (rows.length === 0) {
    return <p className="text-secondary text-body">No concepts yet.</p>;
  }
  return (
    <Card className="p-6">
      <h2 className="text-h3 mb-4">Syllabus coverage</h2>
      <div className="grid gap-4">
        {rows.map((r) => {
          const total = r.total || 1;
          const masteredPct = (r.mastered / total) * 100;
          const progressPct = (r.in_progress / total) * 100;
          const untouched = r.total - r.seen;
          return (
            <div key={r.subject}>
              <div className="mb-1 flex items-center justify-between text-small">
                <span className="font-medium">{r.subject}</span>
                <span className="text-muted">
                  {r.mastered} mastered · {r.in_progress} in progress · {untouched} untouched
                </span>
              </div>
              <div className="flex h-3 overflow-hidden rounded-full bg-mastery-0">
                <div className="bg-mastery-4" style={{ width: `${masteredPct}%` }} />
                <div className="bg-mastery-2" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
