"use client";

import { useActionState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Label, Textarea } from "@/components/ui/Field";
import { bulkIngestQuestions, type BulkIngestState } from "@/app/ingest/actions";

const initial: BulkIngestState = { ok: false, message: "", result: null };

const EXAMPLE = `[
  {
    "concept": "Percentages",
    "stem": "What is 15% of 240?",
    "options": ["30", "36", "40", "45"],
    "correct_option": 1,
    "explanation": "0.15 × 240 = 36.",
    "exam_year": 2021,
    "exam_stage": "cbt1"
  }
]`;

export function BulkIngestForm() {
  const [state, formAction, pending] = useActionState(bulkIngestQuestions, initial);

  return (
    <Card className="p-6">
      <h2 className="text-h3 mb-1">Bulk import (JSON)</h2>
      <p className="text-small text-muted mb-4">
        Paste an array of past-paper questions. <code>concept</code> may be a concept name
        (matched against the ontology) or its numeric id. Duplicates and bad rows are skipped
        and reported — the rest still import.
      </p>
      <form action={formAction} className="grid gap-4">
        <div>
          <Label htmlFor="batch">Question batch</Label>
          <Textarea
            id="batch"
            name="batch"
            required
            rows={12}
            spellCheck={false}
            placeholder={EXAMPLE}
            className="font-mono text-small"
          />
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Importing…" : "Import batch"}
          </Button>
          {state.message && (
            <p className={`text-small ${state.ok ? "text-success" : "text-danger"}`}>
              {state.message}
            </p>
          )}
        </div>

        {state.result && state.result.errors.length > 0 && (
          <div className="bg-subtle rounded-lg p-4">
            <p className="text-caption uppercase tracking-[0.02em] text-secondary mb-2">
              Rejected rows
            </p>
            <ul className="grid gap-1">
              {state.result.errors.map((e, i) => (
                <li key={i} className="text-small text-danger">
                  {e.index >= 0 ? `Row ${e.index + 1}: ` : ""}
                  {e.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </Card>
  );
}
