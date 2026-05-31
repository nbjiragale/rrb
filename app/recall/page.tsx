import { listConcepts } from "@/lib/db/queries/concepts";
import { listRecentInteractions } from "@/lib/db/queries/interactions";
import { RecallWorkspace } from "@/components/recall/RecallWorkspace";

export const dynamic = "force-dynamic";

// J2 — semantic recall surface: jot notes, then search your own words by meaning.
export default async function RecallPage() {
  const [concepts, recentNotes] = await Promise.all([
    listConcepts(),
    listRecentInteractions(8, "note"),
  ]);

  return (
    <div className="mx-auto max-w-column px-6 py-8 md:px-8">
      <h1 className="text-h1 mb-2">Recall</h1>
      <p className="text-secondary text-small mb-6">
        Jot study notes and search everything you&apos;ve written — notes, doubts, and Feynman
        explanations — by meaning.
      </p>
      <RecallWorkspace concepts={concepts} recentNotes={recentNotes} />
    </div>
  );
}
