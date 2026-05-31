"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Select, Textarea } from "@/components/ui/Field";
import { Markdown } from "@/components/ui/Markdown";
import { sendTutorMessage } from "@/app/tutor/actions";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import type { Concept } from "@/lib/db/types";
import type { ChatMessage } from "@/lib/llm/router";

// Pending-state indicator. With web search on, it reads "Searching the web…"
// first (the plugin runs before the answer streams), then "Answering…"; without
// it, a plain "Thinking…". Cosmetic, but communicates that a web lookup is
// happening. Remounts each turn (rendered only while pending), so the timer
// restarts cleanly.
function ThinkingStatus({ webSearch }: { webSearch: boolean }) {
  const [phase, setPhase] = useState<"search" | "answer">(webSearch ? "search" : "answer");
  useEffect(() => {
    if (!webSearch) return;
    const t = setTimeout(() => setPhase("answer"), 2500);
    return () => clearTimeout(t);
  }, [webSearch]);
  const label = !webSearch ? "Thinking…" : phase === "search" ? "Searching the web…" : "Answering…";
  return (
    <p className="text-muted text-body-lg motion-safe:animate-pulse" aria-live="polite">
      {label}
    </p>
  );
}

// Mirrors Claude.ai's chat: assistant text plain on the canvas, user in a soft bubble.
export function TutorChat({ concepts, webSearch = false }: { concepts: Concept[]; webSearch?: boolean }) {
  const firstId = concepts[0]?.id ?? 0;
  const [conceptId, setConceptId] = useLocalStorage<number>("tutor:conceptId", firstId);
  const safeConceptId = concepts.some((c) => c.id === conceptId) ? conceptId : firstId;
  const [messages, setMessages, resetMessages] = useLocalStorage<ChatMessage[]>(
    `tutor:chat:${safeConceptId}`,
    []
  );
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const content = draft.trim();
    if (!content || pending || !safeConceptId) return;

    const history: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(history);
    setDraft("");
    setError(null);
    setPending(true);
    try {
      const { reply } = await sendTutorMessage({ conceptId: safeConceptId, history });
      setMessages([...history, { role: "assistant", content: reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-[760px] flex-col px-6">
      <div className="flex items-center gap-3 py-4">
        <Select
          aria-label="Concept"
          value={safeConceptId}
          onChange={(e) => setConceptId(Number(e.target.value))}
          className="max-w-md"
        >
          {concepts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.subject})
            </option>
          ))}
        </Select>
        {messages.length > 0 && (
          <Button variant="ghost" onClick={resetMessages} disabled={pending}>
            Clear
          </Button>
        )}
        {webSearch && (
          <span className="ml-auto text-caption uppercase tracking-[0.02em] text-muted">
            Web search on
          </span>
        )}
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto py-4">
        {messages.length === 0 && (
          <p className="text-secondary text-body-lg">
            Ask a doubt about this concept, or say “teach me this from scratch.”
          </p>
        )}
        {messages.map((m, i) =>
          m.role === "assistant" ? (
            <div key={i} className="max-w-read">
              <Markdown>{m.content}</Markdown>
            </div>
          ) : (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] whitespace-pre-wrap rounded-xl bg-subtle px-4 py-3 text-body-lg">
                {m.content}
              </div>
            </div>
          )
        )}
        {pending && <ThinkingStatus webSearch={webSearch} />}
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
