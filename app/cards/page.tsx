import Link from "next/link";
import { listCards } from "@/lib/db/queries/cards";
import { listConcepts } from "@/lib/db/queries/concepts";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Label, Input, Textarea, Select } from "@/components/ui/Field";
import { FactCardsForm, GroundedCardsForm } from "@/components/cards/GenerateCardsForm";
import { addCard } from "./actions";

export const dynamic = "force-dynamic";

const stateTone = (s: string) =>
  s === "new" ? "accent" : s === "relearning" ? "warning" : "neutral";

export default async function CardsPage() {
  const [cards, concepts] = await Promise.all([listCards(), listConcepts()]);
  const nonGaConcepts = concepts.filter((c) => c.subject !== "ga");
  const gaConcepts = concepts.filter((c) => c.subject === "ga");

  return (
    <div className="mx-auto max-w-shell px-6 py-8 md:px-8">
      <h1 className="text-h1 mb-6">Cards</h1>

      {concepts.length === 0 ? (
        <Card className="p-6 mb-8">
          <p className="text-body-lg">
            Add a concept first —{" "}
            <Link href="/concepts" className="text-accent-strong underline">
              go to Concepts
            </Link>
            . Cards belong to a concept.
          </p>
        </Card>
      ) : (
        <Card className="p-6 mb-8">
          <h2 className="text-h3 mb-4">Add a card</h2>
          <form action={addCard} className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="concept_id">Concept</Label>
              <Select id="concept_id" name="concept_id" required>
                {concepts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.subject})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="card_type">Type</Label>
              <Select id="card_type" name="card_type" defaultValue="recall">
                <option value="recall">recall</option>
                <option value="cloze">cloze</option>
                <option value="mcq">mcq</option>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="front">Front</Label>
              <Textarea id="front" name="front" required rows={2}
                placeholder="Which article gives the President pardon power?" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="back">Back</Label>
              <Textarea id="back" name="back" required rows={2} placeholder="Article 72." />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="source_ref">Source (optional)</Label>
              <Input id="source_ref" name="source_ref" placeholder="NCERT Class 9 Polity" />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Add card</Button>
            </div>
          </form>
        </Card>
      )}

      {concepts.length > 0 && (
        <div className="mb-8">
          <h2 className="text-h3 mb-1">Generate cards with AI</h2>
          <p className="text-small text-muted mb-4">
            Math/reasoning cards are fact-checked; GA cards must be grounded in a passage you paste.
            Generated cards enter the review queue like any other.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            <FactCardsForm concepts={nonGaConcepts} />
            <GroundedCardsForm concepts={gaConcepts} />
          </div>
        </div>
      )}

      {cards.length === 0 ? (
        <p className="text-secondary text-body-lg">No cards yet.</p>
      ) : (
        <div className="grid gap-3">
          {cards.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-body font-medium truncate">{c.front}</p>
                  <p className="text-small text-muted truncate">{c.back}</p>
                  <p className="text-caption uppercase tracking-[0.02em] text-muted mt-1">
                    {c.concept_name}
                  </p>
                </div>
                <Badge tone={stateTone(c.state)}>{c.state}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
