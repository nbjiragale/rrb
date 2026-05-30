import Link from "next/link";
import { listConcepts, getConcept } from "@/lib/db/queries/concepts";
import { getPracticeQuestions, getWeakSpotQuestions } from "@/lib/db/queries/questions";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PracticeSession } from "@/components/practice/PracticeSession";
import { ConceptResources } from "@/components/ConceptResources";

export const dynamic = "force-dynamic";

// C1 — practise on a chosen concept (?concept=<id>); C2 — weak spots (?mode=weak).
export default async function PracticePage({
  searchParams,
}: {
  searchParams: Promise<{ concept?: string; mode?: string }>;
}) {
  const { concept, mode } = await searchParams;
  const conceptId = concept ? Number(concept) : null;

  if (mode === "weak") {
    const questions = await getWeakSpotQuestions();
    if (questions.length === 0) {
      return <Empty message="No verified questions yet. Ingest some on the Ingest page." />;
    }
    return (
      <div>
        <div className="mx-auto max-w-column px-6 pt-8">
          <Link href="/practice" className="text-small text-accent-strong">
            ← All topics
          </Link>
          <h1 className="mt-2 text-h2">Weak spots</h1>
          <p className="text-secondary text-small">Highest exam-weight, lowest mastery first.</p>
        </div>
        <PracticeSession questions={questions} />
      </div>
    );
  }

  if (conceptId) {
    const [picked, questions] = await Promise.all([
      getConcept(conceptId),
      getPracticeQuestions(conceptId),
    ]);

    if (!picked) {
      return <Empty message="That concept doesn't exist." />;
    }
    if (questions.length === 0) {
      return (
        <Empty
          message={`No verified questions for "${picked.name}" yet. Ingest some on the Ingest page.`}
        />
      );
    }
    return (
      <div>
        <div className="mx-auto max-w-column px-6 pt-8">
          <Link href="/practice" className="text-small text-accent-strong">
            ← All topics
          </Link>
          <h1 className="mt-2 text-h2">{picked.name}</h1>
          <div className="mt-3">
            <ConceptResources conceptId={conceptId} />
          </div>
        </div>
        <PracticeSession questions={questions} />
      </div>
    );
  }

  const concepts = await listConcepts();

  return (
    <div className="mx-auto max-w-shell px-6 py-8 md:px-8">
      <h1 className="text-h1 mb-6">Practice</h1>
      {concepts.length === 0 ? (
        <Empty message="Add concepts and ingest questions first." />
      ) : (
        <div className="grid gap-3">
          <Link href="/practice?mode=weak">
            <Card className="p-4 flex items-center justify-between gap-4 border-accent-border bg-accent-subtle hover:bg-accent-subtle/70 transition-colors duration-150">
              <div>
                <p className="text-body font-medium text-accent-strong">Fix my weak spots</p>
                <p className="text-small text-secondary">Auto-targeted by exam weight × weakness.</p>
              </div>
              <Badge tone="accent">C2</Badge>
            </Card>
          </Link>
          {concepts.map((c) => (
            <Link key={c.id} href={`/practice?concept=${c.id}`}>
              <Card className="p-4 flex items-center justify-between gap-4 hover:bg-hover transition-colors duration-150">
                <div>
                  <p className="text-body font-medium">{c.name}</p>
                  <p className="text-small text-muted">{c.topic}</p>
                </div>
                <Badge tone="accent">{c.subject}</Badge>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-column px-6 py-16 text-center">
      <p className="text-secondary text-body-lg">{message}</p>
    </div>
  );
}
