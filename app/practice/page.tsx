import Link from "next/link";
import { listConcepts, getConcept } from "@/lib/db/queries/concepts";
import { getPracticeQuestions } from "@/lib/db/queries/questions";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PracticeSession } from "@/components/practice/PracticeSession";

export const dynamic = "force-dynamic";

// C1 — practise on a chosen concept. ?concept=<id> picks the topic.
export default async function PracticePage({
  searchParams,
}: {
  searchParams: Promise<{ concept?: string }>;
}) {
  const { concept } = await searchParams;
  const conceptId = concept ? Number(concept) : null;

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
