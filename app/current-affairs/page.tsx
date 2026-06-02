import { listConcepts } from "@/lib/db/queries/concepts";
import { listCaItems } from "@/lib/db/queries/currentAffairs";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CaIngestForm } from "@/components/ca/CaIngestForm";
import { CaDayActions } from "@/components/ca/CaDayActions";
import { CaScrapeButton } from "@/components/ca/CaScrapeButton";
import type { CurrentAffairsItem } from "@/lib/db/types";

export const dynamic = "force-dynamic";

// Epic H — Current Affairs engine. Ingest sources (H1), then build grounded
// cards (H2) / GA questions (C4) for a whole day in one pass, strictly from the
// stored raw_text of that day's items.
export default async function CurrentAffairsPage() {
  const [items, concepts] = await Promise.all([listCaItems(), listConcepts()]);
  const hasGaConcepts = concepts.some((c) => c.subject === "ga");
  const today = new Date().toISOString().slice(0, 10);
  const days = groupByDate(items);

  return (
    <div className="mx-auto max-w-shell px-6 py-8 md:px-8">
      <h1 className="text-h1 mb-6">Current affairs</h1>

      <div className="mb-8">
        <CaIngestForm today={today} />
      </div>

      <div className="mb-8">
        <CaScrapeButton />
      </div>

      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="text-h2">Ingested sources</h2>
        {items.length > 0 && (
          <span className="text-small text-muted">
            <span className="font-mono text-primary">{items.length}</span> source
            {items.length === 1 ? "" : "s"} · <span className="font-mono text-primary">{days.length}</span> day
            {days.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-secondary text-body-lg">Nothing ingested yet.</p>
      ) : (
        <div className="grid gap-5">
          {days.map(({ date, list }) => (
            <Card key={date} className="overflow-hidden p-0">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border bg-subtle px-5 py-3">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-body text-primary">{date}</span>
                  <span className="text-small text-muted">
                    {list.length} item{list.length === 1 ? "" : "s"}
                  </span>
                  {list.every((it) => it.processed_at) && <Badge tone="success">processed</Badge>}
                </div>
                <CaDayActions date={date} hasGaConcepts={hasGaConcepts} />
              </div>

              <ul className="divide-y divide-border">
                {list.map((item, i) => (
                  <li key={item.id} className="flex gap-3 px-5 py-3">
                    <span className="w-5 shrink-0 pt-0.5 font-mono text-small text-muted">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        {item.category && <Badge tone="accent">{item.category}</Badge>}
                        {item.exam_probability != null && (
                          <span className="font-mono text-caption text-muted">
                            {Math.round(item.exam_probability * 100)}% likely
                          </span>
                        )}
                        {item.source_url && (
                          <a
                            href={item.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-caption text-muted underline-offset-2 hover:text-accent-strong hover:underline"
                          >
                            source
                          </a>
                        )}
                      </div>
                      <p className="text-body text-secondary line-clamp-2">{item.raw_text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function groupByDate(items: CurrentAffairsItem[]) {
  const map = new Map<string, CurrentAffairsItem[]>();
  for (const it of items) {
    const arr = map.get(it.ca_date) ?? [];
    arr.push(it);
    map.set(it.ca_date, arr);
  }
  // listCaItems already returns ca_date DESC, so insertion order is newest-first.
  return [...map.entries()].map(([date, list]) => ({ date, list }));
}
