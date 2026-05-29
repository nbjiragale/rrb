import Link from "next/link";
import { listConcepts } from "@/lib/db/queries/concepts";
import { Card } from "@/components/ui/Card";
import { TutorChat } from "@/components/tutor/TutorChat";

export const dynamic = "force-dynamic";

export default async function TutorPage() {
  const concepts = await listConcepts();

  if (concepts.length === 0) {
    return (
      <div className="mx-auto max-w-column px-6 py-8">
        <Card className="p-6">
          <p className="text-body-lg">
            Add a concept first —{" "}
            <Link href="/concepts" className="text-accent-strong underline">
              go to Concepts
            </Link>
            . The tutor tailors answers per concept.
          </p>
        </Card>
      </div>
    );
  }

  return <TutorChat concepts={concepts} />;
}
