"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Label, Select, Textarea } from "@/components/ui/Field";
import { generateFactCardsAction, generateGroundedCardsAction } from "@/app/cards/actions";
import type { Concept } from "@/lib/db/types";

const COUNTS = [3, 5, 10];

// Math/reasoning recall cards — generated freely, then each is independently
// fact-checked before it's saved.
export function FactCardsForm({ concepts }: { concepts: Concept[] }) {
  const [conceptId, setConceptId] = useState(concepts[0]?.id ?? 0);
  const [count, setCount] = useState(5);
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (concepts.length === 0) {
    return <p className="text-small text-muted">Add a math or reasoning concept first.</p>;
  }

  async function run() {
    setPending(true);
    setMsg(null);
    const res = await generateFactCardsAction({ conceptId, count });
    setMsg({ ok: res.ok, text: res.message });
    setPending(false);
  }

  return (
    <Card className="p-6">
      <h3 className="text-h3 mb-1">Math / reasoning</h3>
      <p className="text-small text-muted mb-4">
        Formulas, rules, and method steps — generated, then each card&apos;s answer is
        independently checked before it&apos;s saved.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="fc-concept">Concept</Label>
          <Select id="fc-concept" value={conceptId} onChange={(e) => setConceptId(Number(e.target.value))}>
            {concepts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.subject})
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="fc-count">Count</Label>
          <Select id="fc-count" value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {COUNTS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={run} disabled={pending}>
          {pending ? "Generating…" : "Generate cards"}
        </Button>
        {msg && <p className={`text-small ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}
      </div>
    </Card>
  );
}

// GA recall cards grounded in a pasted passage — every fact must trace to it.
export function GroundedCardsForm({ concepts }: { concepts: Concept[] }) {
  const [conceptId, setConceptId] = useState(concepts[0]?.id ?? 0);
  const [passage, setPassage] = useState("");
  const [count, setCount] = useState(5);
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (concepts.length === 0) {
    return <p className="text-small text-muted">Add a GA concept first.</p>;
  }

  async function run() {
    setPending(true);
    setMsg(null);
    const res = await generateGroundedCardsAction({ conceptId, passage, count });
    setMsg({ ok: res.ok, text: res.message });
    setPending(false);
  }

  return (
    <Card className="p-6">
      <h3 className="text-h3 mb-1">General awareness (from passage)</h3>
      <p className="text-small text-muted mb-4">
        Every card must trace to the passage you paste — ungrounded GA is blocked.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="gc-concept">Concept</Label>
          <Select id="gc-concept" value={conceptId} onChange={(e) => setConceptId(Number(e.target.value))}>
            {concepts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="gc-count">Count</Label>
          <Select id="gc-count" value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {COUNTS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="mt-4">
        <Label htmlFor="gc-passage">Source passage</Label>
        <Textarea
          id="gc-passage"
          rows={6}
          value={passage}
          onChange={(e) => setPassage(e.target.value)}
          placeholder="Paste the factual passage to ground cards in."
        />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={run} disabled={pending || passage.trim().length < 20}>
          {pending ? "Generating…" : "Generate cards"}
        </Button>
        {msg && <p className={`text-small ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}
      </div>
    </Card>
  );
}
