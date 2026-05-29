import { listConcepts } from "@/lib/db/queries/concepts";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Label, Input, Select } from "@/components/ui/Field";
import { addConcept } from "./actions";

export const dynamic = "force-dynamic";

export default async function ConceptsPage() {
  const concepts = await listConcepts();

  return (
    <div className="mx-auto max-w-shell px-6 py-8 md:px-8">
      <h1 className="text-h1 mb-6">Concepts</h1>

      <Card className="p-6 mb-8">
        <h2 className="text-h3 mb-4">Add a concept</h2>
        <form action={addConcept} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required placeholder="President's pardon power (Art. 72)" />
          </div>
          <div>
            <Label htmlFor="subject">Subject</Label>
            <Select id="subject" name="subject" defaultValue="ga">
              <option value="math">math</option>
              <option value="reasoning">reasoning</option>
              <option value="ga">ga</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="topic">Topic</Label>
            <Input id="topic" name="topic" required placeholder="Indian Polity" />
          </div>
          <div>
            <Label htmlFor="subtopic">Subtopic (optional)</Label>
            <Input id="subtopic" name="subtopic" placeholder="Powers of the President" />
          </div>
          <div>
            <Label htmlFor="description">Description (optional)</Label>
            <Input id="description" name="description" />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit">Add concept</Button>
          </div>
        </form>
      </Card>

      {concepts.length === 0 ? (
        <p className="text-secondary text-body-lg">No concepts yet. Add your first above.</p>
      ) : (
        <div className="grid gap-3">
          {concepts.map((c) => (
            <Card key={c.id} className="p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-body font-medium">{c.name}</p>
                <p className="text-small text-muted">
                  {c.topic}
                  {c.subtopic ? ` › ${c.subtopic}` : ""}
                </p>
              </div>
              <Badge tone="accent">{c.subject}</Badge>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
