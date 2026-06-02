import { getDigest } from "@/lib/db/queries/currentAffairs";
import { DigestPlayer } from "@/components/ca/DigestPlayer";
import type { CurrentAffairsItem } from "@/lib/db/types";

export const dynamic = "force-dynamic";

// H3 / H4 — daily current-affairs digest, grouped by category, highest
// likelihood-of-being-asked first; readable on screen and via browser audio.
export default async function DigestPage() {
  const { digestDate, items } = await getDigest();

  if (!digestDate || items.length === 0) {
    return (
      <div className="mx-auto max-w-column px-6 py-16 text-center">
        <h1 className="text-h1 mb-2">Daily digest</h1>
        <p className="text-secondary text-body-lg">
          Nothing to revise yet. Ingest sources on the Current affairs page.
        </p>
      </div>
    );
  }

  const groups = groupByCategory(items);
  const highYield = items.filter((it) => (it.exam_probability ?? 0) >= 0.75).length;

  return (
    <div className="mx-auto max-w-column px-6 py-8 md:px-8">
      <header className="mb-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="text-h1">Daily digest</h1>
          <span className="font-mono text-small text-muted">{digestDate}</span>
        </div>
        <p className="mt-1 text-body text-secondary">
          Current affairs ranked by how likely each item is to appear in the exam.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-muted">
          <Stat value={items.length} label={items.length === 1 ? "item" : "items"} />
          <span aria-hidden>·</span>
          <Stat value={highYield} label="high-yield" />
          <span aria-hidden>·</span>
          <Stat value={groups.length} label={groups.length === 1 ? "topic" : "topics"} />
        </div>
      </header>

      <DigestPlayer groups={groups} totalItems={items.length} />
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <span>
      <span className="font-mono text-primary">{value}</span> {label}
    </span>
  );
}

function groupByCategory(items: CurrentAffairsItem[]) {
  const map = new Map<string, CurrentAffairsItem[]>();
  for (const it of items) {
    const key = it.category ?? "general";
    const arr = map.get(key) ?? [];
    arr.push(it);
    map.set(key, arr);
  }
  return [...map.entries()].map(([category, list]) => ({ category, list }));
}
