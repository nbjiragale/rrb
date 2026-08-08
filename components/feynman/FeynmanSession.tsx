"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Label, Select, Textarea } from "@/components/ui/Field";
import { Markdown } from "@/components/ui/Markdown";
import { gradeFeynmanAction, type FeynmanResult } from "@/app/feynman/actions";
import type { Concept } from "@/lib/db/types";

const RATING_TONE = { solid: "success", partial: "warning", shaky: "danger" } as const;

// J1/G5 — explain a concept in your own words; the tutor grades the gaps.
export function FeynmanSession({ concepts }: { concepts: Concept[] }) {
  const [conceptId, setConceptId] = useState(concepts[0]?.id ?? 0);
  const [explanation, setExplanation] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<FeynmanResult | null>(null);

  async function submit() {
    setPending(true);
    setResult(null);
    const res = await gradeFeynmanAction({ conceptId, explanation });
    setResult(res);
    setPending(false);
  }

  return (
    <div className="grid gap-6">
      <Card className="p-6">
        <div className="mb-4">
          <Label htmlFor="f-concept">Concept</Label>
          <Select id="f-concept" value={conceptId} onChange={(e) => setConceptId(Number(e.target.value))}>
            {concepts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.subject})
              </option>
            ))}
          </Select>
        </div>
        <Label htmlFor="f-text">Explain it as if teaching someone</Label>
        <Textarea
          id="f-text"
          rows={7}
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          placeholder="In your own words…"
        />
        <div className="mt-4">
          <Button onClick={submit} disabled={pending || explanation.trim().length < 20}>
            {pending ? "Grading…" : "Grade my explanation"}
          </Button>
        </div>
      </Card>

      {result && !result.ok && <p className="text-small text-danger">{result.message}</p>}

      {result?.feedback && (
        <Card className="p-6">
          <div className="mb-3 flex items-center gap-2">
            <Badge tone={RATING_TONE[result.feedback.rating]}>{result.feedback.rating}</Badge>
            <span className="text-h3">Feedback</span>
          </div>
          <Markdown className="max-w-read text-body-lg text-primary">
            {result.feedback.assessment}
          </Markdown>
          {result.feedback.gaps.length > 0 && (
            <div className="mt-4">
              <p className="text-caption uppercase tracking-[0.02em] text-secondary mb-2">Gaps to close</p>
              <ul className="list-disc pl-5 text-body text-secondary">
                {result.feedback.gaps.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
