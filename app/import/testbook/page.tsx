import { listConcepts } from "@/lib/db/queries/concepts";
import { TestbookImportPanel } from "@/components/testbook/TestbookImportPanel";

export const dynamic = "force-dynamic";

export default async function TestbookImportPage() {
  const concepts = await listConcepts();
  const options = concepts.map((c) => ({
    id: c.id,
    label: `${c.name} · ${c.topic}`,
  }));

  return (
    <div className="mx-auto max-w-column px-6 py-8 md:px-8">
      <h1 className="text-h1 mb-2">Import Testbook mock</h1>
      <p className="text-body text-secondary mb-6 max-w-read">
        Paste the JSON from a completed Testbook test&apos;s analysis API
        (<code className="text-small">…/analysis</code> →{" "}
        <code className="text-small">studenttestresult</code>). Every question becomes an
        attempt in your own logs, folded into mastery and queued for mistake diagnosis. Your
        data only — nothing is shared.
      </p>
      <TestbookImportPanel concepts={options} />
    </div>
  );
}
