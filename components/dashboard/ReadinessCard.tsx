import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { Readiness } from "@/lib/readiness";

// J3 — one honest number vs a target band, with explicit uncertainty wording.
const CONF_TONE = { low: "danger", medium: "warning", high: "success" } as const;

export function ReadinessCard({
  readiness,
  totalMarks,
  targetMarks,
}: {
  readiness: Readiness;
  totalMarks: number;
  targetMarks: number | null;
}) {
  const r = readiness;
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-h3">Projected readiness</h2>
        <Badge tone={CONF_TONE[r.confidence]}>{r.confidence} confidence</Badge>
      </div>

      <div className="mt-4 flex items-end gap-3">
        <span className="font-mono text-display leading-none">{Math.round(r.expected)}</span>
        <span className="text-secondary text-body mb-1">/ {totalMarks} marks</span>
      </div>

      <p className="mt-2 text-body text-secondary">
        Likely range{" "}
        <span className="font-mono text-primary">
          {Math.round(r.low)}–{Math.round(r.high)}
        </span>
        {targetMarks != null && (
          <>
            {" "}· target <span className="font-mono text-primary">{targetMarks}</span>
            {r.onTrack != null && (
              <Badge tone={r.onTrack ? "success" : "warning"} className="ml-2">
                {r.onTrack ? "on track" : "below target"}
              </Badge>
            )}
          </>
        )}
      </p>

      {/* Band visual: track with the likely range and a target marker. */}
      <BandBar low={r.low} high={r.high} expected={r.expected} total={totalMarks} target={targetMarks} />

      <p className="mt-3 text-small text-muted">{r.note}</p>
      <p className="mt-1 text-small text-muted">
        Based on {r.nMocks} recent mock{r.nMocks === 1 ? "" : "s"} and{" "}
        {Math.round(r.coverage * 100)}% syllabus coverage.
      </p>
    </Card>
  );
}

function BandBar({
  low,
  high,
  expected,
  total,
  target,
}: {
  low: number;
  high: number;
  expected: number;
  total: number;
  target: number | null;
}) {
  const pct = (m: number) => `${Math.min(100, Math.max(0, (m / total) * 100))}%`;
  const left = pct(Math.max(0, low));
  const width = `${Math.min(100, Math.max(0, ((high - Math.max(0, low)) / total) * 100))}%`;
  return (
    <div className="relative mt-4 h-2 rounded-full bg-active">
      <div className="absolute h-2 rounded-full bg-accent-subtle" style={{ left, width }} />
      <div className="absolute h-2 w-[3px] rounded-full bg-accent" style={{ left: pct(expected) }} />
      {target != null && (
        <div
          className="absolute -top-1 h-4 w-[2px] bg-primary"
          style={{ left: pct(target) }}
          title={`target ${target}`}
        />
      )}
    </div>
  );
}
