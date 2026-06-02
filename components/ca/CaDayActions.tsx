"use client";

import { useState } from "react";
import {
  generateCaDayCardsAction,
  generateCaDayQuestionsAction,
} from "@/app/current-affairs/actions";
import { Button } from "@/components/ui/Button";
import { Layers, HelpCircle } from "lucide-react";

// H2 + C4 — one build action per day. A single LLM pass reads all of that day's
// sources together (deduping and prioritising across them); each generated card
// or question stays grounded in a single source item. The model tags each output
// with its own best-fit GA concept, so there's no concept picker here.
export function CaDayActions({ date, hasGaConcepts }: { date: string; hasGaConcepts: boolean }) {
  const [pending, setPending] = useState<"cards" | "questions" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (!hasGaConcepts) {
    return <p className="text-small text-muted">Add a GA concept first to build from this day.</p>;
  }

  async function run(kind: "cards" | "questions") {
    setPending(kind);
    setMsg(null);
    const action = kind === "cards" ? generateCaDayCardsAction : generateCaDayQuestionsAction;
    const res = await action({ date });
    setMsg({ ok: res.ok, text: res.message });
    setPending(null);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" onClick={() => run("cards")} disabled={pending !== null}>
        <Layers size={16} strokeWidth={1.5} className="mr-2" />
        {pending === "cards" ? "Building…" : "Build cards"}
      </Button>
      <Button variant="secondary" onClick={() => run("questions")} disabled={pending !== null}>
        <HelpCircle size={16} strokeWidth={1.5} className="mr-2" />
        {pending === "questions" ? "Building…" : "Build questions"}
      </Button>
      {msg && (
        <span className={`text-small ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</span>
      )}
    </div>
  );
}
