"use client";

import { useState } from "react";
import { generateAdversarialAction } from "@/app/diagnosis/actions";

// C5 — one-tap adversarial drill for a recurring misconception.
export function AdversarialButton({ attemptId }: { attemptId: number }) {
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function run() {
    setPending(true);
    setMsg(null);
    const res = await generateAdversarialAction(attemptId);
    setMsg({ ok: res.ok, text: res.message });
    setPending(false);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="text-small text-accent-strong hover:text-accent-hover underline disabled:opacity-50 transition-colors duration-150"
      >
        {pending ? "Generating…" : "Generate drill"}
      </button>
      {msg && (
        <span className={`text-small ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</span>
      )}
    </div>
  );
}
