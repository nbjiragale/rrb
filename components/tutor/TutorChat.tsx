"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Select, Textarea } from "@/components/ui/Field";
import { sendTutorMessage } from "@/app/tutor/actions";
import type { Concept } from "@/lib/db/types";
import type { ChatMessage } from "@/lib/llm/router";

// Mirrors Claude.ai's chat: assistant text plain on the canvas, user in a soft bubble.
export function TutorChat({ concepts }: { concepts: Concept[] }) {
  const [conceptId, setConceptId] = useState(concepts[0]?.id ?? 0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const content = draft.trim();
    if (!content || pending || !conceptId) return;

    const history: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(history);
    setDraft("");
    setError(null);
    setPending(true);
    try {
      const { reply } = await sendTutorMessage({ conceptId, history });
      setMessages([...history, { role: "assistant", content: reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-[760px] flex-col px-6">
      <div className="py-4">
        <Select
          aria-label="Concept"
          value={conceptId}
          onChange={(e) => setConceptId(Number(e.target.value))}
          className="max-w-md"
        >
          {concepts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.subject})
            </option>
          ))}
        </Select>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto py-4">
        {messages.length === 0 && (
          <p className="text-secondary text-body-lg">
            Ask a doubt about this concept, or say “teach me this from scratch.”
          </p>
        )}
        {messages.map((m, i) =>
          m.role === "assistant" ? (
            <p key={i} className="max-w-read whitespace-pre-wrap text-body-lg text-primary">
              {m.content}
            </p>
          ) : (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] whitespace-pre-wrap rounded-xl bg-subtle px-4 py-3 text-body-lg">
                {m.content}
              </div>
            </div>
          )
        )}
        {pending && <p className="text-muted text-body-lg">· · ·</p>}
        {error && <p className="text-danger text-small">{error}</p>}
      </div>

      <div className="sticky bottom-0 bg-canvas py-4">
        <div className="flex items-end gap-2 rounded-xl border border-border-strong bg-surface p-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder="Ask a doubt…"
            className="border-0 focus-visible:ring-0 focus:border-0"
          />
          <Button onClick={send} disabled={pending || !draft.trim()}>
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
