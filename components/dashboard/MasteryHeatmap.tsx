import Link from "next/link";
import { masteryBucket, MASTERY_LABEL, type MasteryBucket } from "@/lib/mastery";
import type { HeatmapCell } from "@/lib/db/queries/insights";

// J1 — topic × concept grid coloured by the 0–4 mastery scale; tap a cell to
// practise that concept.
const CELL_BG: Record<MasteryBucket, string> = {
  0: "bg-mastery-0",
  1: "bg-mastery-1",
  2: "bg-mastery-2",
  3: "bg-mastery-3",
  4: "bg-mastery-4",
};

export function MasteryHeatmap({ cells }: { cells: HeatmapCell[] }) {
  if (cells.length === 0) {
    return <p className="text-secondary text-body">No concepts yet.</p>;
  }

  const byTopic = new Map<string, HeatmapCell[]>();
  for (const c of cells) {
    const key = `${c.subject} · ${c.topic}`;
    const list = byTopic.get(key) ?? [];
    list.push(c);
    byTopic.set(key, list);
  }

  return (
    <div>
      <div className="grid gap-4">
        {[...byTopic.entries()].map(([topic, list]) => (
          <div key={topic}>
            <p className="text-caption uppercase tracking-[0.02em] text-secondary mb-2">{topic}</p>
            <div className="flex flex-wrap gap-1.5">
              {list.map((cell) => {
                const b = cell.attempts === 0 ? 0 : masteryBucket(cell.p_known);
                return (
                  <Link
                    key={cell.concept_id}
                    href={`/practice?concept=${cell.concept_id}`}
                    title={`${cell.name} — ${MASTERY_LABEL[b]} (${Math.round(cell.p_known * 100)}%, ${cell.attempts} attempts)`}
                    className={`h-9 min-w-9 max-w-[160px] truncate rounded-md ${CELL_BG[b]} border border-border px-2 text-small leading-9 text-primary/80 transition-transform duration-150 hover:scale-[1.03]`}
                  >
                    {cell.name}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <Legend />
    </div>
  );
}

function Legend() {
  return (
    <div className="mt-5 flex items-center gap-3 text-small text-muted">
      <span>Mastery</span>
      {([0, 1, 2, 3, 4] as const).map((b) => (
        <span key={b} className="flex items-center gap-1.5">
          <span className={`h-3 w-3 rounded-sm ${CELL_BG[b]} border border-border`} />
          {MASTERY_LABEL[b]}
        </span>
      ))}
    </div>
  );
}
