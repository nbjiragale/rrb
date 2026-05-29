import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { MockAnalysis } from "@/lib/services/mock";

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

// D4/D5 — post-mock analysis: score, where marks leaked, weakest topics, pacing.
export function MockResult({ analysis, onRestart }: { analysis: MockAnalysis; onRestart: () => void }) {
  const slowest = Math.max(0, ...analysis.perQuestionMs);

  return (
    <div className="mx-auto max-w-column px-6 py-8">
      <h1 className="text-h1 mb-6">Mock analysis</h1>

      <Card className="p-6 mb-6">
        <p className="text-display font-mono">{analysis.score.toFixed(2)}</p>
        <p className="text-small text-muted">net score</p>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <Stat label="Correct" value={analysis.correct} tone="text-success" />
          <Stat label="Wrong" value={analysis.wrong} tone="text-danger" />
          <Stat label="Skipped" value={analysis.skipped} tone="text-muted" />
        </div>
        <p className="mt-4 text-small text-secondary">
          Accuracy {pct(analysis.accuracy)} · lost {analysis.marksLostToWrong.toFixed(2)} marks to wrong
          answers · {analysis.marksLeftOnTable} left blank.
        </p>
      </Card>

      <h2 className="text-h3 mb-3">Topics (weakest first)</h2>
      <Card className="p-2 mb-6">
        {analysis.byTopic.map((t) => (
          <div key={t.topic} className="flex items-center justify-between gap-4 rounded-md p-3">
            <span className="text-body">{t.topic}</span>
            <span className="text-small text-muted">
              {t.correct}✓ {t.wrong}✗ {t.skipped}– · {pct(t.accuracy)}
            </span>
          </div>
        ))}
      </Card>

      <h2 className="text-h3 mb-3">Pacing</h2>
      <Card className="p-4 mb-8">
        <div className="flex items-end gap-1" style={{ height: 80 }}>
          {analysis.perQuestionMs.map((ms, i) => (
            <div
              key={i}
              title={`Q${i + 1}: ${(ms / 1000).toFixed(1)}s`}
              className="flex-1 rounded-sm bg-accent-subtle"
              style={{ height: slowest > 0 ? `${Math.max(4, (ms / slowest) * 100)}%` : "4%" }}
            />
          ))}
        </div>
        <p className="mt-2 text-small text-muted">Time per question (taller = slower).</p>
      </Card>

      <Button onClick={onRestart}>Take another</Button>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-md bg-subtle p-3">
      <p className={`text-h2 ${tone}`}>{value}</p>
      <p className="text-caption uppercase tracking-[0.02em] text-muted">{label}</p>
    </div>
  );
}
