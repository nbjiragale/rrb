"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Segmented } from "@/components/ui/Segmented";
import { Label, Select, Input, Textarea } from "@/components/ui/Field";
import { Markdown } from "@/components/ui/Markdown";
import {
  saveNoteAction,
  recallAction,
  type RecallActionResult,
} from "@/app/recall/actions";
import type { Concept, Interaction, InteractionType } from "@/lib/db/types";
import type { SemanticMatch } from "@/lib/db/queries/interactions";

const TYPE_TONE: Record<InteractionType, "accent" | "warning" | "success"> = {
  note: "accent",
  doubt: "warning",
  feynman: "success",
};

const GENERAL = 0; // sentinel for "no concept" in the select

type Filter = "all" | InteractionType;
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "note", label: "Notes" },
  { value: "doubt", label: "Doubts" },
  { value: "feynman", label: "Feynman" },
];

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function RecallWorkspace({
  concepts,
  recentNotes,
}: {
  concepts: Concept[];
  recentNotes: Interaction[];
}) {
  const router = useRouter();
  const conceptName = useMemo(() => {
    const m = new Map<number, string>();
    for (const c of concepts) m.set(c.id, c.name);
    return m;
  }, [concepts]);

  // Note composer
  const [noteConceptId, setNoteConceptId] = useState<number>(GENERAL);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  async function saveNote() {
    setSavingNote(true);
    setNoteError(null);
    const res = await saveNoteAction({
      conceptId: noteConceptId === GENERAL ? null : noteConceptId,
      content: noteText,
    });
    setSavingNote(false);
    if (res.ok) {
      setNoteText("");
      router.refresh();
    } else {
      setNoteError(res.message ?? "Could not save note.");
    }
  }

  // Recall search
  const [queryText, setQueryText] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<RecallActionResult | null>(null);

  async function search() {
    setSearching(true);
    setResult(null);
    const res = await recallAction({
      query: queryText,
      type: filter === "all" ? null : filter,
    });
    setResult(res);
    setSearching(false);
  }

  function renderMatch(m: SemanticMatch, mode: "semantic" | "text") {
    const cname = m.concept_id ? conceptName.get(m.concept_id) : null;
    return (
      <Card key={m.id} className="p-4">
        <div className="mb-2 flex items-center gap-2">
          <Badge tone={TYPE_TONE[m.type]}>{m.type}</Badge>
          {cname && <span className="text-small text-secondary">{cname}</span>}
          <span className="text-small text-muted">· {fmtDate(m.created_at)}</span>
          {mode === "semantic" && (
            <span className="ml-auto text-small text-muted">{Math.round(m.similarity * 100)}% match</span>
          )}
        </div>
        <p className="text-body whitespace-pre-wrap">{m.content}</p>
        {m.ai_feedback && (
          <div className="mt-2 border-t border-border pt-2">
            <Markdown className="text-small text-secondary">{m.ai_feedback}</Markdown>
          </div>
        )}
      </Card>
    );
  }

  return (
    <div className="grid gap-6">
      {/* Jot a note */}
      <Card className="p-6">
        <h2 className="text-h3 mb-4">Jot a note</h2>
        <div className="mb-4">
          <Label htmlFor="r-concept">Concept</Label>
          <Select
            id="r-concept"
            value={noteConceptId}
            onChange={(e) => setNoteConceptId(Number(e.target.value))}
          >
            <option value={GENERAL}>General (no concept)</option>
            {concepts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.subject})
              </option>
            ))}
          </Select>
        </div>
        <Label htmlFor="r-note">Note</Label>
        <Textarea
          id="r-note"
          rows={4}
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="A fact, a trick, a thing you keep forgetting…"
        />
        {noteError && <p className="mt-2 text-small text-danger">{noteError}</p>}
        <div className="mt-4">
          <Button onClick={saveNote} disabled={savingNote || noteText.trim().length < 3}>
            {savingNote ? "Saving…" : "Save note"}
          </Button>
        </div>
      </Card>

      {/* Search your memory */}
      <Card className="p-6">
        <h2 className="text-h3 mb-4">Search your memory</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor="r-query">Search by meaning</Label>
            <Input
              id="r-query"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && queryText.trim().length >= 2) search();
              }}
              placeholder="What did I write about…"
            />
          </div>
          <Button onClick={search} disabled={searching || queryText.trim().length < 2}>
            {searching ? "Searching…" : "Search"}
          </Button>
        </div>
        <div className="mt-3">
          <Segmented<Filter>
            options={FILTERS}
            value={filter}
            onChange={setFilter}
            ariaLabel="Filter by memory type"
          />
        </div>

        {result && !result.ok && <p className="mt-4 text-small text-danger">{result.message}</p>}
        {result?.ok && (
          <div className="mt-4">
            {result.result.matches.length === 0 ? (
              <p className="text-secondary text-body">No matches yet — try different words.</p>
            ) : (
              <>
                {result.result.mode === "text" && (
                  <p className="mb-3 text-small text-muted">
                    Keyword match (semantic recall needs an embeddings provider configured).
                  </p>
                )}
                <div className="grid gap-3">
                  {result.result.matches.map((m) => renderMatch(m, result.result.mode))}
                </div>
              </>
            )}
          </div>
        )}
      </Card>

      {/* Recent notes */}
      {recentNotes.length > 0 && (
        <div>
          <p className="text-caption uppercase tracking-[0.02em] text-secondary mb-2">Recent notes</p>
          <div className="grid gap-3">
            {recentNotes.map((n) => (
              <Card key={n.id} className="p-4">
                <div className="mb-1 flex items-center gap-2">
                  {n.concept_id && (
                    <span className="text-small text-secondary">{conceptName.get(n.concept_id)}</span>
                  )}
                  <span className="text-small text-muted">{fmtDate(n.created_at)}</span>
                </div>
                <p className="text-body whitespace-pre-wrap">{n.content}</p>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
