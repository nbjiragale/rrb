import { listConcepts } from "@/lib/db/queries/concepts";
import { FeynmanSession } from "@/components/feynman/FeynmanSession";

export const dynamic = "force-dynamic";

// G5 / J1 — Feynman mode: explain a concept, get graded, build recallable memory.
export default async function FeynmanPage() {
  const concepts = await listConcepts();

  return (
    <div className="mx-auto max-w-column px-6 py-8 md:px-8">
      <h1 className="text-h1 mb-2">Feynman mode</h1>
      <p className="text-secondary text-small mb-6">
        Explain a concept in your own words. The tutor grades it for gaps and remembers it for later.
      </p>
      {concepts.length === 0 ? (
        <p className="text-secondary text-body-lg">Add a concept first.</p>
      ) : (
        <FeynmanSession concepts={concepts} />
      )}
    </div>
  );
}
