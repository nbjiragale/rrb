"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import type { TopicTrendPoint } from "@/lib/db/queries/snapshots";

// J2 — per-topic p_known over time. Thin SVG lines, accent for the selected
// topic, neutrals for context (UIdesignspec: minimal gridlines).
const W = 640;
const H = 200;
const PAD = 28;

export function TrendChart({ points }: { points: TopicTrendPoint[] }) {
  const topics = useMemo(
    () => [...new Set(points.map((p) => p.topic))].sort(),
    [points]
  );
  const [selected, setSelected] = useState<string | null>(topics[0] ?? null);

  // Distinct sorted dates → x positions.
  const dates = useMemo(() => [...new Set(points.map((p) => p.snapshot_date))].sort(), [points]);

  if (dates.length < 2) {
    return (
      <Card className="p-6">
        <h2 className="text-h3 mb-1">Mastery trend</h2>
        <p className="text-secondary text-body">
          Collecting data — trends appear once there are at least two days of history.
        </p>
      </Card>
    );
  }

  const x = (date: string) => {
    const i = dates.indexOf(date);
    return PAD + (i / (dates.length - 1)) * (W - 2 * PAD);
  };
  const y = (p: number) => H - PAD - p * (H - 2 * PAD);

  const series = topics.map((topic) => ({
    topic,
    path: lineFor(points.filter((p) => p.topic === topic), x, y),
  }));

  return (
    <Card className="p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-h3">Mastery trend</h2>
        <div className="flex flex-wrap gap-1.5">
          {topics.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setSelected(t)}
              className={`rounded-full px-2.5 py-0.5 text-caption transition-colors duration-150 ${
                t === selected ? "bg-accent-subtle text-accent-strong" : "text-muted hover:bg-hover"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Mastery over time">
        {/* baseline + midline */}
        <line x1={PAD} y1={y(0)} x2={W - PAD} y2={y(0)} stroke="var(--border-default)" strokeWidth={1} />
        <line x1={PAD} y1={y(0.5)} x2={W - PAD} y2={y(0.5)} stroke="var(--border-default)" strokeWidth={1} strokeDasharray="3 4" />
        <text x={4} y={y(1) + 4} className="fill-muted" fontSize={10}>100%</text>
        <text x={4} y={y(0.5) + 4} className="fill-muted" fontSize={10}>50%</text>
        {series.map((s) => (
          <path
            key={s.topic}
            d={s.path}
            fill="none"
            stroke={s.topic === selected ? "var(--accent)" : "var(--border-strong)"}
            strokeWidth={s.topic === selected ? 2 : 1}
            strokeLinejoin="round"
            opacity={s.topic === selected ? 1 : 0.5}
          />
        ))}
      </svg>
      <p className="mt-1 text-small text-muted">
        {dates[0]} → {dates[dates.length - 1]}
      </p>
    </Card>
  );
}

function lineFor(
  pts: TopicTrendPoint[],
  x: (d: string) => number,
  y: (p: number) => number
): string {
  return pts
    .slice()
    .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.snapshot_date).toFixed(1)} ${y(p.avg_p_known).toFixed(1)}`)
    .join(" ");
}
