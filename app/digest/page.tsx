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

  return (
    <div className="mx-auto max-w-column px-6 py-8 md:px-8">
      <h1 className="text-h1 mb-1">Daily digest</h1>
      <p className="text-secondary text-small mb-6 font-mono">{digestDate}</p>
      <DigestPlayer groups={groups} />
    </div>
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
