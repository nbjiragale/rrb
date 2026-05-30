import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { RefitButton } from "@/components/calibration/RefitButton";
import { AdversarialButton } from "@/components/diagnosis/AdversarialButton";
import { getConfidenceAccuracy, getLatestCalibrationModel } from "@/lib/db/queries/calibration";
import { getConfidentWrongAttempts } from "@/lib/db/queries/attempts";
import { getExamConfig } from "@/lib/db/queries/examConfig";
import {
  predictAccuracy,
  expectedValue,
  breakEvenP,
  type LogisticModel,
} from "@/lib/calibration";

export const dynamic = "force-dynamic";

// G2 (calibration curve) + G3 (EV trainer) + G4 (confident-but-wrong).
export default async function CalibrationPage() {
  const [buckets, model, config, confidentWrong] = await Promise.all([
    getConfidenceAccuracy(),
    getLatestCalibrationModel(),
    getExamConfig(),
    getConfidentWrongAttempts(4, 20),
  ]);

  const negRatio = config?.negative_mark_ratio ?? 1 / 3;
  const breakEven = breakEvenP(negRatio);
  const logistic: LogisticModel | null =
    model?.coef_confidence != null && model.coef_intercept != null
      ? { intercept: model.coef_intercept, slope: model.coef_confidence, nSamples: model.n_samples ?? 0 }
      : null;

  return (
    <div className="mx-auto max-w-shell px-6 py-8 md:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h1">Calibration & EV</h1>
          <p className="text-secondary text-small">
            How your stated confidence lines up with reality — and when to attempt vs skip under
            −{negRatio.toFixed(2)} marking.
          </p>
        </div>
        <RefitButton />
      </div>

      {/* G2 — calibration curve: stated confidence vs observed accuracy */}
      <Card className="p-6 mb-6">
        <h2 className="text-h3 mb-4">Confidence vs accuracy</h2>
        {buckets.length === 0 ? (
          <p className="text-secondary text-body">No graded attempts with confidence yet.</p>
        ) : (
          <div className="grid gap-3">
            {buckets.map((b) => {
              const predicted = logistic ? predictAccuracy(logistic, b.confidence) : null;
              const over = b.confidence / 5 - b.accuracy; // >0 ⇒ overconfident
              return (
                <div key={b.confidence} className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
                  <span className="font-mono text-small text-muted w-16">conf {b.confidence}</span>
                  <div className="h-2 rounded-full bg-active">
                    <div
                      className="h-2 rounded-full bg-accent"
                      style={{ width: `${Math.round(b.accuracy * 100)}%` }}
                    />
                  </div>
                  <span className="text-small text-secondary w-40 text-right">
                    {Math.round(b.accuracy * 100)}% actual ({b.correct}/{b.n})
                    {predicted != null ? ` · ${Math.round(predicted * 100)}% fit` : ""}
                    {Math.abs(over) > 0.15 ? (
                      <Badge tone={over > 0 ? "danger" : "warning"} className="ml-2">
                        {over > 0 ? "over" : "under"}
                      </Badge>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* G3 — EV trainer */}
      <Card className="p-6 mb-6">
        <h2 className="text-h3 mb-1">Attempt or skip?</h2>
        <p className="text-small text-muted mb-4">
          EV = P · 1 − (1 − P) · {negRatio.toFixed(2)}. Attempt only when P &gt; {Math.round(breakEven * 100)}%.
        </p>
        {!logistic ? (
          <p className="text-secondary text-body">
            Recompute calibration once you have ≥ 5 graded attempts to see per-confidence guidance.
          </p>
        ) : (
          <div className="grid gap-2">
            {[1, 2, 3, 4, 5].map((c) => {
              const p = predictAccuracy(logistic, c);
              const ev = expectedValue(p, negRatio);
              const attempt = ev > 0;
              return (
                <div
                  key={c}
                  className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-0"
                >
                  <span className="font-mono text-small text-secondary">confidence {c}</span>
                  <span className="text-small text-muted">
                    P≈{Math.round(p * 100)}% · EV {ev >= 0 ? "+" : ""}
                    {ev.toFixed(2)}
                  </span>
                  <Badge tone={attempt ? "success" : "danger"}>{attempt ? "attempt" : "skip"}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* G4 — confident but wrong */}
      <Card className="p-6">
        <h2 className="text-h3 mb-1">Confident but wrong</h2>
        <p className="text-small text-muted mb-4">Your most dangerous gaps — sure, and wrong.</p>
        {confidentWrong.length === 0 ? (
          <p className="text-secondary text-body">None logged. Good calibration on hard items.</p>
        ) : (
          <div className="grid gap-3">
            {confidentWrong.map((a) => (
              <div
                key={a.attempt_id}
                className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3 last:border-0"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge tone="danger">conf {a.confidence}</Badge>
                    <span className="text-small text-muted">{a.concept_name}</span>
                  </div>
                  <p className="text-body mt-1">{a.stem}</p>
                  <p className="text-small text-secondary mt-0.5">
                    chose {a.selected_text ? `"${a.selected_text}"` : "—"}; correct &quot;{a.correct_text}&quot;
                  </p>
                </div>
                <AdversarialButton attemptId={a.attempt_id} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
