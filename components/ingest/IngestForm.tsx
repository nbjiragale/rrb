"use client";

import { useActionState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Label, Input, Textarea, Select } from "@/components/ui/Field";
import { ingestQuestion, type IngestState } from "@/app/ingest/actions";
import type { Concept } from "@/lib/db/types";

const initial: IngestState = { ok: false, message: "" };

export function IngestForm({ concepts }: { concepts: Concept[] }) {
  const [state, formAction, pending] = useActionState(ingestQuestion, initial);

  return (
    <Card className="p-6">
      <h2 className="text-h3 mb-4">Ingest a past-paper question</h2>
      <form action={formAction} className="grid gap-4">
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
          <Label htmlFor="stem">Question stem</Label>
          <Textarea id="stem" name="stem" required rows={2} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i}>
              <Label htmlFor={`option_${i}`}>Option {i + 1}</Label>
              <Input id={`option_${i}`} name={`option_${i}`} required />
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="correct_option">Correct option</Label>
            <Select id="correct_option" name="correct_option" defaultValue="0">
              <option value="0">Option 1</option>
              <option value="1">Option 2</option>
              <option value="2">Option 3</option>
              <option value="3">Option 4</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="exam_year">Exam year</Label>
            <Input id="exam_year" name="exam_year" type="number" placeholder="2019" />
          </div>
          <div>
            <Label htmlFor="exam_stage">Stage</Label>
            <Select id="exam_stage" name="exam_stage" defaultValue="cbt1">
              <option value="cbt1">cbt1</option>
              <option value="cbt2">cbt2</option>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="explanation">Explanation (optional)</Label>
          <Textarea id="explanation" name="explanation" rows={2} />
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Adding…" : "Add question"}
          </Button>
          {state.message && (
            <p className={`text-small ${state.ok ? "text-success" : "text-danger"}`}>
              {state.message}
            </p>
          )}
        </div>
      </form>
    </Card>
  );
}
