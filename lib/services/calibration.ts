import {
  fitLogistic,
  brierScore,
  evThresholdConfidence,
  type CalibrationSample,
} from "@/lib/calibration";
import { getExamConfig } from "@/lib/db/queries/examConfig";
import {
  getCalibrationSamples,
  insertCalibrationModel,
} from "@/lib/db/queries/calibration";
import { recomputeCalibrationError } from "@/lib/db/queries/mastery";

const DEFAULT_NEG_RATIO = 1 / 3; // RRB NTPC penalty if exam_config is absent.

export interface CalibrationRefit {
  fitted: boolean;
  nSamples: number;
  evThreshold: number | null;
  brier: number | null;
  conceptsUpdated: number;
}

// Nightly (walkthrough C.2): refit confidence → accuracy and recompute per-concept
// calibration error. Skips gracefully when there isn't enough data yet.
export async function refitCalibration(): Promise<CalibrationRefit> {
  const samples = (await getCalibrationSamples()) as CalibrationSample[];
  const model = fitLogistic(samples);
  if (!model) {
    const conceptsUpdated = await recomputeCalibrationError();
    return { fitted: false, nSamples: samples.length, evThreshold: null, brier: null, conceptsUpdated };
  }

  const config = await getExamConfig();
  const negRatio = config?.negative_mark_ratio ?? DEFAULT_NEG_RATIO;
  const evThreshold = evThresholdConfidence(model, negRatio);
  const brier = brierScore(model, samples);

  await insertCalibrationModel({
    coef_intercept: model.intercept,
    coef_confidence: model.slope,
    n_samples: model.nSamples,
    brier_score: brier,
    ev_threshold: evThreshold,
  });

  const conceptsUpdated = await recomputeCalibrationError();
  return { fitted: true, nSamples: model.nSamples, evThreshold, brier, conceptsUpdated };
}
