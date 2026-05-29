import { listConcepts } from "@/lib/db/queries/concepts";
import { MathGenerateForm, GaGenerateForm } from "@/components/generate/GenerateForms";

export const dynamic = "force-dynamic";

// C3 / C4 — on-demand question generation behind the verify gate. Math/reasoning
// is generated freely + re-solved; GA is grounded in a pasted passage.
export default async function GeneratePage() {
  const concepts = await listConcepts();
  const mathConcepts = concepts.filter((c) => c.subject !== "ga");
  const gaConcepts = concepts.filter((c) => c.subject === "ga");

  return (
    <div className="mx-auto max-w-shell px-6 py-8 md:px-8">
      <h1 className="text-h1 mb-2">Generate questions</h1>
      <p className="text-secondary text-small mb-6">
        Everything here passes the verify gate before it can be practised — only verified items are served.
      </p>
      <div className="grid gap-6">
        <MathGenerateForm concepts={mathConcepts} />
        <GaGenerateForm concepts={gaConcepts} />
      </div>
    </div>
  );
}
