"use client";

import { useState } from "react";
import {
  generateCaCardsAction,
  generateCaQuestionsAction,
} from "@/app/current-affairs/actions";

// H2 + C4 — from one CA item, build grounded cards or grounded GA questions.
// The LLM tags each generated item with its own best-fit GA concept (one news
// piece often spans science + defence + achievements), so no concept dropdown
// here — routing is per item, not per batch.
export function CaItemActions({
  caId,
  hasGaConcepts,
}: {
  caId: number;
  hasGaConcepts: boolean;
}) {
  const [pending, setPending] = useState<"cards" | "questions" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (!hasGaConcepts) {
    return <p className="text-small text-muted">Add a GA concept first to generate from this item.</p>;
  }

  async function run(kind: "cards" | "questions") {
    setPending(kind);
    setMsg(null);
    const action = kind === "cards" ? generateCaCardsAction : generateCaQuestionsAction;
    const res = await action({ caId, count: 5 });
    setMsg({ ok: res.ok, text: res.message });
    setPending(null);
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
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
