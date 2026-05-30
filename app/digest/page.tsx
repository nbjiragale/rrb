import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getDigest } from "@/lib/db/queries/currentAffairs";
import type { CurrentAffairsItem } from "@/lib/db/types";

export const dynamic = "force-dynamic";

// H3 / H4 — daily current-affairs digest, grouped by category, highest
// likelihood-of-being-asked first.
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

  const byCategory = groupByCategory(items);

  return (
    <div className="mx-auto max-w-column px-6 py-8 md:px-8">
      <h1 className="text-h1 mb-1">Daily digest</h1>
      <p className="text-secondary text-small mb-6 font-mono">{digestDate}</p>

      <div className="grid gap-6">
        {byCategory.map(({ category, list }) => (
          <section key={category}>
            <h2 className="text-caption uppercase tracking-[0.02em] text-secondary mb-2">{category}</h2>
            <div className="grid gap-2">
              {list.map((item) => (
                <Card key={item.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-body-lg max-w-read">
                      {item.summary ?? truncate(item.raw_text, 200)}
                    </p>
                    {item.exam_probability != null && (
                      <Badge tone={item.exam_probability >= 0.7 ? "accent" : "neutral"}>
                        {Math.round(item.exam_probability * 100)}%
                      </Badge>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>
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

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n).trimEnd()}…` : s;
}
