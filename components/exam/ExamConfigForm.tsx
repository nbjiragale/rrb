"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Label, Input } from "@/components/ui/Field";
import { saveExamConfigAction } from "@/app/exam/actions";
import type { ExamConfig } from "@/lib/db/types";

interface Section {
  name: string;
  questions: number;
  marks: number;
  time_s: number;
}

// RRB NTPC CBT-1 default. Section names contain the keywords the mock assembler
// maps to subjects (math / reason / aware), so sectional mocks resolve. time_s 0
// means "auto" — the mock falls back to ~54s per question.
const DEFAULT_SECTIONS: Section[] = [
  { name: "Mathematics", questions: 30, marks: 30, time_s: 0 },
  { name: "General Intelligence & Reasoning", questions: 30, marks: 30, time_s: 0 },
  { name: "General Awareness", questions: 40, marks: 40, time_s: 0 },
];

export function ExamConfigForm({ config }: { config: ExamConfig | null }) {
  const [examName, setExamName] = useState(config?.exam_name ?? "RRB NTPC");
  const [examDate, setExamDate] = useState(config?.exam_date ?? "");
  const [negRatio, setNegRatio] = useState(config?.negative_mark_ratio ?? 0.3333);
  const [sections, setSections] = useState<Section[]>(
    config?.sections?.length ? config.sections : DEFAULT_SECTIONS
  );
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function updateSection(i: number, patch: Partial<Section>) {
    setSections((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  }
  function addSection() {
    setSections((prev) => [...prev, { name: "", questions: 30, marks: 30, time_s: 0 }]);
  }
  function removeSection(i: number) {
    setSections((prev) => prev.filter((_, j) => j !== i));
  }

  async function save() {
    setPending(true);
    setMsg(null);
    const res = await saveExamConfigAction({
      exam_name: examName,
      exam_date: examDate,
      negative_mark_ratio: negRatio,
      locale: config?.locale ?? "en",
      sections,
    });
    setMsg({ ok: res.ok, text: res.message });
    setPending(false);
  }

  return (
    <div className="grid gap-6">
      <Card className="p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <Label htmlFor="exam_name">Exam name</Label>
            <Input id="exam_name" value={examName} onChange={(e) => setExamName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="exam_date">Exam date</Label>
            <Input
              id="exam_date"
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="neg_ratio">Negative mark ratio</Label>
            <Input
              id="neg_ratio"
              type="number"
              step="0.0001"
              min={0}
              max={1}
              value={negRatio}
              onChange={(e) => setNegRatio(Number(e.target.value))}
            />
          </div>
        </div>
        <p className="mt-2 text-small text-muted">
          RRB NTPC penalty is 1/3 (≈ 0.3333). Leave the date blank if you haven&apos;t fixed it —
          the planner&apos;s exam backstop only kicks in within 21 days of a set date.
        </p>
      </Card>

      <Card className="p-6">
        <h2 className="text-h3 mb-1">Sections</h2>
        <p className="text-small text-muted mb-4">
          Mocks build from these. Keep a math / reasoning / awareness keyword in each name so
          sectional mocks map correctly. Time 0 = auto (~54s per question).
        </p>
        <div className="grid gap-3">
          {sections.map((s, i) => (
            <div key={i} className="grid items-end gap-3 sm:grid-cols-[1fr,5rem,5rem,6rem,auto]">
              <div>
                <Label htmlFor={`s-name-${i}`}>Name</Label>
                <Input
                  id={`s-name-${i}`}
                  value={s.name}
                  onChange={(e) => updateSection(i, { name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor={`s-q-${i}`}>Qs</Label>
                <Input
                  id={`s-q-${i}`}
                  type="number"
                  min={1}
                  value={s.questions}
                  onChange={(e) => updateSection(i, { questions: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor={`s-m-${i}`}>Marks</Label>
                <Input
                  id={`s-m-${i}`}
                  type="number"
                  min={0}
                  value={s.marks}
                  onChange={(e) => updateSection(i, { marks: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor={`s-t-${i}`}>Time (s)</Label>
                <Input
                  id={`s-t-${i}`}
                  type="number"
                  min={0}
                  value={s.time_s}
                  onChange={(e) => updateSection(i, { time_s: Number(e.target.value) })}
                />
              </div>
              <Button
                variant="ghost"
                onClick={() => removeSection(i)}
                disabled={sections.length === 1}
                className="text-danger"
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <Button variant="secondary" onClick={addSection}>
            Add section
          </Button>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save exam configuration"}
        </Button>
        {msg && <p className={`text-small ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}
      </div>
    </div>
  );
}
