"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Label, Textarea, Input, Select } from "@/components/ui/Field";
import {
  importTestbookMockAction,
  mapTestbookTagAction,
  type ImportState,
} from "@/app/import/testbook/actions";

interface ConceptOption {
  id: number;
  label: string;
}

export function TestbookImportPanel({ concepts }: { concepts: ConceptOption[] }) {
  const [rawJson, setRawJson] = useState("");
  const [testId, setTestId] = useState("");
  const [state, setState] = useState<ImportState | null>(null);
  const [pending, startTransition] = useTransition();

  const runImport = () => {
    startTransition(async () => {
      setState(await importTestbookMockAction({ rawJson, externalTestId: testId || null }));
    });
  };

  return (
    <div className="grid gap-6">
      <Card className="p-6">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            runImport();
          }}
        >
          <div>
            <Label htmlFor="testId">Test ID (optional, from the URL)</Label>
            <Input
              id="testId"
              value={testId}
              onChange={(e) => setTestId(e.target.value)}
              placeholder="69b7a11b8f6d28fc8c338fd9"
              spellCheck={false}
              className="font-mono text-small"
            />
          </div>
          <div>
            <Label htmlFor="rawJson">Result JSON</Label>
            <Textarea
              id="rawJson"
              value={rawJson}
              onChange={(e) => setRawJson(e.target.value)}
              required
              rows={10}
              spellCheck={false}
              placeholder='{ "data": { "sections": [ … ] } }'
              className="font-mono text-small"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending || rawJson.trim() === ""}>
              {pending ? "Importing…" : "Import mock"}
            </Button>
            {state && !state.ok && <p className="text-small text-danger">{state.message}</p>}
          </div>
        </form>
      </Card>

      {state?.ok && (
        <ImportSummary
          result={state.result}
          concepts={concepts}
          onReimport={runImport}
          reimporting={pending}
        />
      )}
    </div>
  );
}

function ImportSummary({
  result,
  concepts,
  onReimport,
  reimporting,
}: {
  result: Extract<ImportState, { ok: true }>["result"];
  concepts: ConceptOption[];
  onReimport: () => void;
  reimporting: boolean;
}) {
  if (result.alreadyImported) {
    return (
      <Card className="p-6">
        <p className="text-body">
          This mock was already imported (session #{result.mockSessionId}). Nothing changed.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6 grid gap-5">
      <div>
        <h2 className="text-h3 mb-1">{result.title}</h2>
        <p className="text-small text-muted">
          Session #{result.mockSessionId} · {result.imported} attempts imported
          {result.skippedUnmapped > 0 && ` · ${result.skippedUnmapped} skipped (unmapped)`}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge tone="success">{result.correct} correct</Badge>
        <Badge tone="danger">{result.wrong} wrong</Badge>
        <Badge tone="neutral">{result.unattempted} skipped</Badge>
        <Badge tone="accent">
          score {result.score} · {Math.round(result.accuracy * 100)}% acc
        </Badge>
        {result.rushed > 0 && <Badge tone="warning">{result.rushed} rushed</Badge>}
      </div>

      {result.rushed > 0 && (
        <p className="text-small text-secondary bg-warning-subtle rounded-md px-3 py-2">
          {result.rushed} wrong answer{result.rushed > 1 ? "s were" : " was"} far faster than the
          cohort average — likely rushed traps, not knowledge gaps.
        </p>
      )}

      {result.weakestTopics.length > 0 && (
        <div>
          <p className="text-caption uppercase tracking-[0.02em] text-secondary mb-2">
            Weakest topics
          </p>
          <ul className="grid gap-1">
            {result.weakestTopics.slice(0, 6).map((t) => (
              <li key={t.tag} className="text-small flex justify-between">
                <span>{t.tag}</span>
                <span className="text-muted">
                  {t.correct}✓ {t.wrong}✗ {t.skipped}–
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.unmappedTags.length > 0 && (
        <UnmappedTags
          tags={result.unmappedTags}
          concepts={concepts}
          onReimport={onReimport}
          reimporting={reimporting}
        />
      )}
    </Card>
  );
}

function UnmappedTags({
  tags,
  concepts,
  onReimport,
  reimporting,
}: {
  tags: { tag: string; count: number }[];
  concepts: ConceptOption[];
  onReimport: () => void;
  reimporting: boolean;
}) {
  const [mapped, setMapped] = useState<Record<string, string>>({});

  return (
    <div className="bg-subtle rounded-lg p-4 grid gap-3">
      <div>
        <p className="text-caption uppercase tracking-[0.02em] text-secondary mb-1">
          Unmapped topics
        </p>
        <p className="text-small text-muted">
          These tags didn&apos;t match a concept, so their questions were skipped (never
          guessed). Map them, then re-import to capture those attempts.
        </p>
      </div>
      <ul className="grid gap-2">
        {tags.map((t) => (
          <li key={t.tag} className="flex flex-wrap items-center gap-2">
            <span className="text-small min-w-[10rem]">
              {t.tag} <span className="text-muted">×{t.count}</span>
            </span>
            <TagMapper
              tag={t.tag}
              concepts={concepts}
              done={mapped[t.tag]}
              onMapped={(label) => setMapped((m) => ({ ...m, [t.tag]: label }))}
            />
          </li>
        ))}
      </ul>
      {Object.keys(mapped).length > 0 && (
        <div>
          <Button variant="secondary" onClick={onReimport} disabled={reimporting}>
            {reimporting ? "Re-importing…" : "Re-import with new mappings"}
          </Button>
        </div>
      )}
    </div>
  );
}

function TagMapper({
  tag,
  concepts,
  done,
  onMapped,
}: {
  tag: string;
  concepts: ConceptOption[];
  done?: string;
  onMapped: (label: string) => void;
}) {
  const [conceptId, setConceptId] = useState("");
  const [pending, startTransition] = useTransition();

  if (done) {
    return <span className="text-small text-success">→ {done}</span>;
  }

  const save = () => {
    if (!conceptId) return;
    startTransition(async () => {
      const res = await mapTestbookTagAction({ tag, conceptId: Number(conceptId) });
      if (res.ok) {
        onMapped(concepts.find((c) => String(c.id) === conceptId)?.label ?? "mapped");
      }
    });
  };

  return (
    <span className="flex items-center gap-2">
      <Select
        value={conceptId}
        onChange={(e) => setConceptId(e.target.value)}
        className="text-small"
      >
        <option value="">Map to concept…</option>
        {concepts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </Select>
      <Button variant="ghost" onClick={save} disabled={pending || !conceptId}>
        {pending ? "…" : "Map"}
      </Button>
    </span>
  );
}
