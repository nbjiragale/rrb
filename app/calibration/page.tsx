import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { Explainer } from "@/components/ui/Explainer";
import { RefitButton } from "@/components/calibration/RefitButton";
import { AdversarialButton } from "@/components/diagnosis/AdversarialButton";
import { getConfidenceAccuracy, getLatestCalibrationModel } from "@/lib/db/queries/calibration";
import { getConfidentWrongAttempts } from "@/lib/db/queries/attempts";
import { getExamConfig } from "@/lib/db/queries/examConfig";
import { predictAccuracy, expectedValue, breakEvenP, type LogisticModel } from "@/lib/calibration";

export const dynamic = "force-dynamic";

// Plain words for the 1–5 confidence rating, so the report never shows "conf 3".
const CONFIDENCE_WORD: Record<number, string> = {
  1: "Just guessing",
  2: "Not sure",
  3: "Leaning one way",
  4: "Fairly sure",
  5: "Certain",
};

const pct = (x: number) => Math.round(x * 100);

// G2 (calibration curve) + G3 (EV trainer) + G4 (confident-but-wrong),
// rewritten as a report a learner can actually read (humanise; UIredesignspec §2).
export default async function CalibrationPage() {
  const [buckets, model, config, confidentWrong] = await Promise.all([
    getConfidenceAccuracy(),
    getLatestCalibrationModel(),
    getExamConfig(),
    getConfidentWrongAttempts(4, 20),
  ]);

  const negRatio = config?.negative_mark_ratio ?? 1 / 3;
  const breakEven = breakEvenP(negRatio);
  const breakEvenPct = pct(breakEven);
  const penaltyText =
    Math.abs(negRatio - 1 / 3) < 0.02 ? "a third of a mark" : `${negRatio.toFixed(2)} of a mark`;

  const logistic: LogisticModel | null =
    model?.coef_confidence != null && model.coef_intercept != null
      ? { intercept: model.coef_intercept, slope: model.coef_confidence, nSamples: model.n_samples ?? 0 }
      : null;

  // Sort "most sure" first — reads top-down from certainty to guessing.
  const sorted = [...buckets].sort((a, b) => b.confidence - a.confidence);
  const totalN = buckets.reduce((s, b) => s + b.n, 0);

  // Overall verdict: average gap between how sure you felt (confidence/5 read as
  // a claimed chance) and how often you were actually right, weighted by volume.
  const weightedGap = totalN
    ? buckets.reduce((s, b) => s + (b.confidence / 5 - b.accuracy) * b.n, 0) / totalN
    : 0;
  const verdict =
    weightedGap > 0.1
      ? {
          tone: "warning" as const,
          title: "You tend to be overconfident",
          body: "You often feel surer than your results back up. When you're not genuinely confident, leaning towards skipping will protect your score.",
        }
      : weightedGap < -0.1
        ? {
            tone: "neutral" as const,
            title: "You tend to be underconfident",
            body: "You actually know more than you give yourself credit for. Trust yourself a little more — you may be skipping questions you'd have gotten right.",
          }
        : {
            tone: "success" as const,
            title: "Your confidence is well matched",
            body: "How sure you feel lines up nicely with how often you're right. That's exactly what good exam judgement looks like.",
          };

  return (
    <>
      <PageHeader title="Confidence report" width="read" action={<RefitButton />} />

      <div className="mx-auto grid max-w-read gap-6 px-6 py-8 md:px-8">
        {/* Plain-English summary up top */}
        {totalN === 0 ? (
          <Card className="p-6">
            <h2 className="mb-2 text-h3">No confidence ratings yet</h2>
            <p className="max-w-read text-body text-secondary">
              In <span className="font-medium text-primary">Practice</span>, you mark how sure you
              are (1 = guessing, 5 = certain) before each answer. After about 5–10 questions, this
              report shows whether your gut matches your real accuracy — and when it&apos;s worth
              attempting versus skipping.
            </p>
          </Card>
        ) : (
          <Card className="p-6">
            <div className="mb-2 flex items-center gap-3">
              <h2 className="text-h3">{verdict.title}</h2>
              <Badge tone={verdict.tone}>{weightedGap > 0.1 ? "overconfident" : weightedGap < -0.1 ? "underconfident" : "well matched"}</Badge>
            </div>
            <p className="max-w-read text-body text-secondary">{verdict.body}</p>
            <p className="mt-3 text-small text-muted">
              Based on {totalN} answer{totalN === 1 ? "" : "s"} where you rated how sure you were.
            </p>
          </Card>
        )}

        {/* How often you're right at each confidence level */}
        {sorted.length > 0 && (
          <Card className="p-6">
            <h2 className="text-h3">How often you&apos;re right at each confidence level</h2>
            <p className="mt-1 text-small text-secondary">
              For every question you rate how sure you are. Here&apos;s how that actually played out.
            </p>
            <Explainer>
              We read a <span className="font-medium">5</span> as &ldquo;I&apos;m certain&rdquo; and
              a <span className="font-medium">1</span> as &ldquo;pure guess&rdquo;. If you&apos;re
              right <em>less</em> often than you felt, you&apos;re overconfident on those; if you&apos;re
              right <em>more</em> often, you sold yourself short.
            </Explainer>

            <div className="mt-5 grid gap-4">
              {sorted.map((b) => {
                const gap = b.confidence / 5 - b.accuracy; // >0 ⇒ overconfident
                const tag =
                  gap > 0.15
                    ? { tone: "warning" as const, label: "Right less often than you felt" }
                    : gap < -0.15
                      ? { tone: "neutral" as const, label: "Right more often than you felt" }
                      : { tone: "success" as const, label: "Well matched" };
                return (
                  <div key={b.confidence}>
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <span className="text-body">
                        {CONFIDENCE_WORD[b.confidence]}{" "}
                        <span className="font-mono text-small text-muted">({b.confidence}/5)</span>
                      </span>
                      <span className="text-small text-secondary">
                        <span className="font-medium text-primary">{pct(b.accuracy)}% right</span>{" "}
                        <span className="text-muted">
                          ({b.correct} of {b.n})
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-2 flex-1 rounded-full bg-active">
                        <div
                          className="h-2 rounded-full bg-accent"
                          style={{ width: `${pct(b.accuracy)}%` }}
                        />
                      </div>
                      <Badge tone={tag.tone} uppercase={false} className="shrink-0">
                        {tag.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* When to attempt vs skip */}
        <Card className="p-6">
          <h2 className="text-h3">When to attempt and when to skip</h2>
          <p className="mt-1 text-small text-secondary">
            A wrong answer costs {penaltyText}, so a wild guess can lose you marks. Based on your
            track record:
          </p>
          <Explainer>
            You only need to be right more than{" "}
            <span className="font-medium">{breakEvenPct}% of the time</span> (about 1 in 4) for an
            attempt to pay off on average — because a wrong answer costs {penaltyText} while a right
            one earns a full mark. Below that line, skipping protects your score.
          </Explainer>

          {!logistic ? (
            <p className="mt-4 text-body text-secondary">
              Not enough data yet. After about 5 answers where you&apos;ve rated your confidence,
              you&apos;ll see attempt-or-skip guidance for each level here.
            </p>
          ) : (
            <div className="mt-5 grid gap-2.5">
              {[5, 4, 3, 2, 1].map((c) => {
                const p = predictAccuracy(logistic, c);
                const ev = expectedValue(p, negRatio);
                const attempt = ev > 0;
                return (
                  <div
                    key={c}
                    className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border-subtle pb-2.5 last:border-0 last:pb-0"
                  >
                    <span className="text-body">
                      {CONFIDENCE_WORD[c]}{" "}
                      <span className="font-mono text-small text-muted">({c}/5)</span>
                    </span>
                    <span className="text-small text-muted">
                      right about {pct(p)}% of the time · {ev >= 0 ? "earns" : "loses"}{" "}
                      <span className={ev >= 0 ? "text-success" : "text-danger"}>
                        {ev >= 0 ? "+" : "−"}
                        {Math.abs(ev).toFixed(2)} marks
                      </span>{" "}
                      each on average
                    </span>
                    <Badge tone={attempt ? "success" : "danger"} uppercase={false}>
                      {attempt ? "Worth attempting" : "Better to skip"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Confident but wrong */}
        <Card className="p-6">
          <h2 className="text-h3">Your most costly mistakes</h2>
          <p className="mt-1 text-small text-secondary">
            Questions you felt sure about but got wrong. These quietly cost the most marks, so
            they&apos;re the highest-value things to review.
          </p>
          {confidentWrong.length === 0 ? (
            <p className="mt-4 text-body text-secondary">
              Nothing here — when you&apos;re sure, you&apos;re usually right. That&apos;s a great
              sign.
            </p>
          ) : (
            <div className="mt-5 grid gap-4">
              {confidentWrong.map((a) => (
                <div
                  key={a.attempt_id}
                  className="flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle pb-4 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="danger" uppercase={false}>
                        You felt: {CONFIDENCE_WORD[a.confidence].toLowerCase()}
                      </Badge>
                      <span className="text-small text-muted">{a.concept_name}</span>
                    </div>
                    <p className="mt-1.5 text-body">{a.stem}</p>
                    <p className="mt-1 text-small text-secondary">
                      You chose {a.selected_text ? `“${a.selected_text}”` : "—"} · correct answer was{" "}
                      <span className="text-primary">“{a.correct_text}”</span>
                    </p>
                  </div>
                  <AdversarialButton attemptId={a.attempt_id} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
