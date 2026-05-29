import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { AdversarialButton } from "@/components/diagnosis/AdversarialButton";
import {
  getRecurringMisconceptions,
  getKindDistribution,
  type RecurringMisconception,
} from "@/lib/db/queries/misconceptions";
import type { MisconceptionKind } from "@/lib/db/types";

export const dynamic = "force-dynamic";

// Factual, non-judgmental tints per kind (UIdesignspec / §12 diagnosis screen).
const KIND_TONE: Record<MisconceptionKind, "neutral" | "warning" | "danger" | "accent" | "success"> = {
  confusion: "warning",
  factual_gap: "neutral",
  partial_rule: "warning",
  computational: "accent",
  conceptual: "danger",
  trap: "danger",
  stale: "success",
};

const KIND_LABEL: Record<MisconceptionKind, string> = {
  confusion: "confusion",
  factual_gap: "factual gap",
  partial_rule: "partial rule",
  computational: "computational",
  conceptual: "conceptual",
  trap: "trap",
  stale: "stale",
};

// F2 / F3 — recurring misconceptions per concept + error-kind shape per subject.
export default async function DiagnosisPage() {
  const [recurring, kinds] = await Promise.all([
    getRecurringMisconceptions(),
    getKindDistribution(),
  ]);

  if (recurring.length === 0) {
    return (
      <div className="mx-auto max-w-column px-6 py-16 text-center">
        <h1 className="text-h1 mb-2">Diagnosis</h1>
        <p className="text-secondary text-body-lg">
          No misconceptions diagnosed yet. Wrong answers in Practice get analysed automatically.
        </p>
      </div>
    );
  }

  const bySubject = groupKindsBySubject(kinds);
  const byConcept = groupByConcept(recurring);

  return (
    <div className="mx-auto max-w-shell px-6 py-8 md:px-8">
      <h1 className="text-h1 mb-2">Diagnosis</h1>
      <p className="text-secondary text-small mb-6">
        Your recurring traps, grouped by concept. The shape of errors per subject hints at the fix.
      </p>

      {/* F3 — error-kind distribution per subject */}
      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        {Object.entries(bySubject).map(([subject, list]) => (
          <Card key={subject} className="p-5">
            <p className="text-caption uppercase tracking-[0.02em] text-secondary mb-3">{subject}</p>
            <div className="flex flex-wrap gap-2">
              {list.map((k) => (
                <span key={k.kind} className="inline-flex items-center gap-1.5">
                  <Badge tone={KIND_TONE[k.kind]}>{KIND_LABEL[k.kind]}</Badge>
                  <span className="text-small text-muted">{k.hit_count}</span>
                </span>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {/* F2 — recurring misconceptions per concept */}
      <div className="grid gap-4">
        {byConcept.map(({ conceptName, items }) => (
          <Card key={conceptName} className="p-6">
            <h2 className="text-h3 mb-4">{conceptName}</h2>
            <div className="grid gap-3">
              {items.map((m) => (
                <div
                  key={m.label}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge tone={KIND_TONE[m.kind]}>{KIND_LABEL[m.kind]}</Badge>
                      <span className="text-body font-medium">{m.label.replace(/_/g, " ")}</span>
                      <span className="text-small text-muted">×{m.hit_count}</span>
                    </div>
                    <p className="text-small text-secondary mt-1">{m.description}</p>
                  </div>
                  {m.kind !== "stale" && <AdversarialButton attemptId={m.sample_attempt_id} />}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function groupByConcept(rows: RecurringMisconception[]) {
  const map = new Map<string, RecurringMisconception[]>();
  for (const r of rows) {
    const arr = map.get(r.concept_name) ?? [];
    arr.push(r);
    map.set(r.concept_name, arr);
  }
  return [...map.entries()].map(([conceptName, items]) => ({ conceptName, items }));
}

function groupKindsBySubject(rows: { subject: string; kind: MisconceptionKind; hit_count: number }[]) {
  const map: Record<string, { kind: MisconceptionKind; hit_count: number }[]> = {};
  for (const r of rows) {
    (map[r.subject] ??= []).push({ kind: r.kind, hit_count: r.hit_count });
  }
  return map;
}
