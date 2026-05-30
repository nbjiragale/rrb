"use client";

import { useActionState, useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Label, Input, Select } from "@/components/ui/Field";
import { Trash2, ExternalLink } from "lucide-react";
import {
  addConceptResource,
  removeConceptResource,
  type ResourceState,
} from "@/app/graph/actions";
import type { Concept } from "@/lib/db/types";
import type { ResourceWithConcept } from "@/lib/db/queries/resources";

const initial: ResourceState = { ok: false, message: "" };

// A4 — manage external "where to learn" pointers per concept.
export function ResourceManager({
  concepts,
  resources,
}: {
  concepts: Concept[];
  resources: ResourceWithConcept[];
}) {
  const [state, formAction, pending] = useActionState(addConceptResource, initial);

  return (
    <div className="grid gap-6">
      <Card className="p-6">
        <h2 className="text-h3 mb-4">Add a learning resource</h2>
        <form action={formAction} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="r_concept">Concept</Label>
            <Select id="r_concept" name="concept_id" required>
              {concepts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.subject})
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="r_kind">Kind</Label>
            <Select id="r_kind" name="kind" defaultValue="book">
              <option value="book">book</option>
              <option value="video">video</option>
              <option value="article">article</option>
              <option value="notes">notes</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="r_priority">Priority</Label>
            <Input id="r_priority" name="priority" type="number" min={1} max={99} defaultValue={1} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="r_label">Label</Label>
            <Input id="r_label" name="label" required placeholder="NCERT Class 9 History, Ch. 2" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="r_url">URL (optional)</Label>
            <Input id="r_url" name="url" type="url" placeholder="https://…" />
          </div>
          <div className="sm:col-span-2 flex items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add resource"}
            </Button>
            {state.message && (
              <p className={`text-small ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p>
            )}
          </div>
        </form>
      </Card>

      {resources.length > 0 && (
        <div className="grid gap-2">
          {resources.map((r) => (
            <ResourceRow key={r.id} resource={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function ResourceRow({ resource }: { resource: ResourceWithConcept }) {
  const [pending, start] = useTransition();
  const [removed, setRemoved] = useState(false);
  if (removed) return null;

  return (
    <Card className="flex items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {resource.kind && <Badge tone="neutral">{resource.kind}</Badge>}
          <span className="text-body font-medium truncate">{resource.label}</span>
        </div>
        <p className="text-small text-muted">
          {resource.concept_name} · priority {resource.priority}
        </p>
      </div>
      <div className="flex items-center gap-3">
        {resource.url && (
          <a
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-secondary hover:text-accent-strong"
            aria-label="Open resource"
          >
            <ExternalLink size={16} strokeWidth={1.5} />
          </a>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await removeConceptResource(resource.id);
              setRemoved(true);
            })
          }
          className="text-muted hover:text-danger disabled:opacity-50"
          aria-label="Delete resource"
        >
          <Trash2 size={16} strokeWidth={1.5} />
        </button>
      </div>
    </Card>
  );
}
