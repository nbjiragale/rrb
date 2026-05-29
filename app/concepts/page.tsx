import { listConcepts } from "@/lib/db/queries/concepts";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { addConcept } from "./actions";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full bg-surface border border-border-strong rounded-md px-3.5 py-2.5 text-body text-primary placeholder:text-muted focus:border-accent focus:outline-none focus-visible:ring-4 focus-visible:ring-focus";
const labelCls = "block text-caption uppercase tracking-[0.02em] text-secondary mb-1.5";

export default async function ConceptsPage() {
  const concepts = await listConcepts();

  return (
    <div className="mx-auto max-w-shell px-6 py-8 md:px-8">
      <h1 className="text-h1 mb-6">Concepts</h1>

      <Card className="p-6 mb-8">
        <h2 className="text-h3 mb-4">Add a concept</h2>
        <form action={addConcept} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="name">Name</label>
            <input id="name" name="name" required className={inputCls}
              placeholder="President's pardon power (Art. 72)" />
          </div>
          <div>
            <label className={labelCls} htmlFor="subject">Subject</label>
            <select id="subject" name="subject" className={inputCls} defaultValue="ga">
              <option value="math">math</option>
              <option value="reasoning">reasoning</option>
              <option value="ga">ga</option>
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="topic">Topic</label>
            <input id="topic" name="topic" required className={inputCls} placeholder="Indian Polity" />
          </div>
          <div>
            <label className={labelCls} htmlFor="subtopic">Subtopic (optional)</label>
            <input id="subtopic" name="subtopic" className={inputCls} placeholder="Powers of the President" />
          </div>
          <div>
            <label className={labelCls} htmlFor="description">Description (optional)</label>
            <input id="description" name="description" className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <button className="rounded-md bg-accent px-5 py-2.5 text-body font-medium text-on-accent hover:bg-accent-hover transition-colors duration-150 focus:outline-none focus-visible:ring-4 focus-visible:ring-focus">
              Add concept
            </button>
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
