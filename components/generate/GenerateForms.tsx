"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Label, Select, Textarea } from "@/components/ui/Field";
import { generateMathAction, generateGaPassageAction } from "@/app/generate/actions";
import type { Concept } from "@/lib/db/types";

// C3 — generate verified math/reasoning questions for a concept.
export function MathGenerateForm({ concepts }: { concepts: Concept[] }) {
  const [conceptId, setConceptId] = useState(concepts[0]?.id ?? 0);
  const [difficulty, setDifficulty] = useState("medium");
  const [count, setCount] = useState(3);
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (concepts.length === 0) {
    return <p className="text-small text-muted">Add a math or reasoning concept first.</p>;
  }

  async function run() {
    setPending(true);
    setMsg(null);
    const res = await generateMathAction({ conceptId, difficulty, count });
    setMsg({ ok: res.ok, text: res.message });
    setPending(false);
  }

  return (
    <Card className="p-6">
      <h2 className="text-h3 mb-1">Math / reasoning</h2>
      <p className="text-small text-muted mb-4">
        Generated freely, then each candidate is independently re-solved before it&apos;s served.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="m-concept">Concept</Label>
          <Select id="m-concept" value={conceptId} onChange={(e) => setConceptId(Number(e.target.value))}>
            {concepts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.subject})
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="m-diff">Difficulty</Label>
          <Select id="m-diff" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            <option value="easy">easy</option>
            <option value="medium">medium</option>
            <option value="hard">hard</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="m-count">Count</Label>
          <Select id="m-count" value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {[1, 3, 5, 10].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={run} disabled={pending}>
          {pending ? "Generating…" : "Generate"}
        </Button>
        {msg && <p className={`text-small ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}
      </div>
    </Card>
  );
}

// C4 — generate verified GA questions grounded in a pasted passage.
export function GaGenerateForm({ concepts }: { concepts: Concept[] }) {
  const [conceptId, setConceptId] = useState(concepts[0]?.id ?? 0);
  const [passage, setPassage] = useState("");
  const [count, setCount] = useState(3);
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (concepts.length === 0) {
    return <p className="text-small text-muted">Add a GA concept first.</p>;
  }

  async function run() {
    setPending(true);
    setMsg(null);
    const res = await generateGaPassageAction({ conceptId, passage, count });
    setMsg({ ok: res.ok, text: res.message });
    setPending(false);
  }

  return (
    <Card className="p-6">
      <h2 className="text-h3 mb-1">General awareness (from passage)</h2>
      <p className="text-small text-muted mb-4">
        Every fact must trace to the passage you paste — ungrounded GA is blocked.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="g-concept">Concept</Label>
          <Select id="g-concept" value={conceptId} onChange={(e) => setConceptId(Number(e.target.value))}>
            {concepts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="g-count">Count</Label>
          <Select id="g-count" value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {[1, 3, 5, 10].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="mt-4">
        <Label htmlFor="g-passage">Source passage</Label>
        <Textarea
          id="g-passage"
          rows={6}
          value={passage}
          onChange={(e) => setPassage(e.target.value)}
          placeholder="Paste the factual passage to ground questions in."
        />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={run} disabled={pending || passage.trim().length < 20}>
          {pending ? "Generating…" : "Generate"}
        </Button>
        {msg && <p className={`text-small ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}
      </div>
    </Card>
  );
}
