// Confidence calibration + negative-marking EV (CLAUDE.md §7). Pure functions,
// no I/O — fitted nightly over (confidence, correct) pairs and consulted by the
// EV trainer. Logistic regression maps self-reported confidence (1–5) → true
// P(correct).

export interface CalibrationSample {
  confidence: number; // 1..5
  correct: boolean;
}

export interface LogisticModel {
  intercept: number;
  slope: number;
  nSamples: number;
}

export function sigmoid(z: number): number {
  if (z >= 0) return 1 / (1 + Math.exp(-z));
  const e = Math.exp(z);
  return e / (1 + e);
}

export function logit(p: number): number {
  const c = Math.min(Math.max(p, 1e-6), 1 - 1e-6);
  return Math.log(c / (1 - c));
}

// Fit P(correct) = sigmoid(intercept + slope·confidence) by gradient descent.
// Returns null when there aren't enough samples to fit anything meaningful.
export function fitLogistic(
  samples: CalibrationSample[],
  opts: { lr?: number; iters?: number } = {}
): LogisticModel | null {
  if (samples.length < 5) return null;
  const lr = opts.lr ?? 0.1;
  const iters = opts.iters ?? 3000;

  let intercept = 0;
  let slope = 0;
  const n = samples.length;

  for (let it = 0; it < iters; it++) {
    let gI = 0;
    let gS = 0;
    for (const s of samples) {
      const x = s.confidence;
      const pred = sigmoid(intercept + slope * x);
      const err = pred - (s.correct ? 1 : 0);
      gI += err;
      gS += err * x;
    }
    intercept -= (lr * gI) / n;
    slope -= (lr * gS) / n;
  }

  return { intercept, slope, nSamples: n };
}

export function predictAccuracy(model: LogisticModel, confidence: number): number {
  return sigmoid(model.intercept + model.slope * confidence);
}

// Mean squared error of predicted probability vs outcome — calibration quality.
export function brierScore(model: LogisticModel, samples: CalibrationSample[]): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const s of samples) {
    const p = predictAccuracy(model, s.confidence);
    const y = s.correct ? 1 : 0;
    sum += (p - y) * (p - y);
  }
  return sum / samples.length;
}

// Break-even probability under negative marking: EV = P − (1−P)·negRatio = 0.
// For RRB's 1/3 penalty this is 0.25 (CLAUDE.md §7).
export function breakEvenP(negRatio: number): number {
  return negRatio / (1 + negRatio);
}

export function expectedValue(p: number, negRatio: number): number {
  return p - (1 - p) * negRatio;
}

// The confidence level at which attempting becomes +EV: solve
// predictAccuracy(c) = breakEvenP. Returns null for a degenerate (flat/negative)
// fit where confidence carries no usable signal.
export function evThresholdConfidence(model: LogisticModel, negRatio: number): number | null {
  if (model.slope <= 1e-6) return null;
  const c = (logit(breakEvenP(negRatio)) - model.intercept) / model.slope;
  return c;
}
