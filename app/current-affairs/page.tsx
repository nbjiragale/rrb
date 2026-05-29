import { listConcepts } from "@/lib/db/queries/concepts";
import { listCaItems } from "@/lib/db/queries/currentAffairs";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CaIngestForm } from "@/components/ca/CaIngestForm";
import { CaItemActions } from "@/components/ca/CaItemActions";

export const dynamic = "force-dynamic";

// Epic H — Current Affairs engine. Ingest a source (H1), then build grounded
// cards (H2) / GA questions (C4) strictly from its stored raw_text.
export default async function CurrentAffairsPage() {
  const [items, concepts] = await Promise.all([listCaItems(), listConcepts()]);
  const gaConcepts = concepts.filter((c) => c.subject === "ga");
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-shell px-6 py-8 md:px-8">
      <h1 className="text-h1 mb-6">Current affairs</h1>

      <div className="mb-8">
        <CaIngestForm today={today} />
      </div>

      <h2 className="text-h2 mb-4">Ingested sources</h2>
      {items.length === 0 ? (
        <p className="text-secondary text-body-lg">Nothing ingested yet.</p>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <Card key={item.id} className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-small font-mono text-muted">{item.ca_date}</span>
                {item.category && <Badge tone="accent">{item.category}</Badge>}
                {item.processed_at && <Badge tone="success">processed</Badge>}
              </div>
              <p className="mt-2 text-body text-secondary line-clamp-3">{item.raw_text}</p>
              <CaItemActions caId={item.id} gaConcepts={gaConcepts} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
