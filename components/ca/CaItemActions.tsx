"use client";

import { useState } from "react";
import { Select } from "@/components/ui/Field";
import {
  generateCaCardsAction,
  generateCaQuestionsAction,
} from "@/app/current-affairs/actions";
import type { Concept } from "@/lib/db/types";

// H2 + C4 — from one CA item, build grounded cards or grounded GA questions,
// tagged to a chosen GA concept.
export function CaItemActions({ caId, gaConcepts }: { caId: number; gaConcepts: Concept[] }) {
  const [conceptId, setConceptId] = useState(gaConcepts[0]?.id ?? 0);
  const [pending, setPending] = useState<"cards" | "questions" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (gaConcepts.length === 0) {
    return <p className="text-small text-muted">Add a GA concept first to generate from this item.</p>;
  }

  async function run(kind: "cards" | "questions") {
    setPending(kind);
    setMsg(null);
    const action = kind === "cards" ? generateCaCardsAction : generateCaQuestionsAction;
    const res = await action({ caId, conceptId, count: 5 });
    setMsg({ ok: res.ok, text: res.message });
    setPending(null);
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Select
        aria-label="Concept"
        value={conceptId}
        onChange={(e) => setConceptId(Number(e.target.value))}
        className="!w-auto !py-1.5 text-small"
      >
        {gaConcepts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      <button
        type="button"
        onClick={() => run("cards")}
        disabled={pending !== null}
        className="text-small text-accent-strong hover:text-accent-hover underline disabled:opacity-50"
      >
        {pending === "cards" ? "Building…" : "Generate cards"}
      </button>
      <button
        type="button"
        onClick={() => run("questions")}
        disabled={pending !== null}
        className="text-small text-accent-strong hover:text-accent-hover underline disabled:opacity-50"
      >
        {pending === "questions" ? "Building…" : "Generate questions"}
      </button>
      {msg && <span className={`text-small ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</span>}
    </div>
  );
}
