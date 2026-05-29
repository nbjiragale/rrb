"use client";

import { useActionState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Label, Input, Textarea } from "@/components/ui/Field";
import { ingestCaAction, type CaState } from "@/app/current-affairs/actions";

const initial: CaState = { ok: false, message: "" };

// H1 — paste a current-affairs source; raw_text is retained for grounding.
export function CaIngestForm({ today }: { today: string }) {
  const [state, formAction, pending] = useActionState(ingestCaAction, initial);

  return (
    <Card className="p-6">
      <h2 className="text-h3 mb-4">Ingest a source</h2>
      <form action={formAction} className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="ca_date">Date</Label>
            <Input id="ca_date" name="ca_date" type="date" defaultValue={today} required />
          </div>
          <div>
            <Label htmlFor="category">Category</Label>
            <Input id="category" name="category" placeholder="appointments / sports / schemes" />
          </div>
          <div>
            <Label htmlFor="source_url">Source URL (optional)</Label>
            <Input id="source_url" name="source_url" type="url" placeholder="https://…" />
          </div>
        </div>
        <div>
          <Label htmlFor="raw_text">Source text</Label>
          <Textarea id="raw_text" name="raw_text" rows={6} required placeholder="Paste the article / bulletin text. Cards and questions are grounded strictly in this." />
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Ingesting…" : "Ingest"}
          </Button>
          {state.message && (
            <p className={`text-small ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p>
          )}
        </div>
      </form>
    </Card>
  );
}
