import { query, queryOne } from "@/lib/db/client";
import type { CalibrationModel } from "@/lib/db/types";

export async function insertCalibrationModel(input: {
  coef_intercept: number;
  coef_confidence: number;
  n_samples: number;
  brier_score: number;
  ev_threshold: number | null;
}): Promise<CalibrationModel> {
  const row = await queryOne<CalibrationModel>(
    `INSERT INTO calibration_model
       (coef_intercept, coef_confidence, n_samples, brier_score, ev_threshold)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [input.coef_intercept, input.coef_confidence, input.n_samples, input.brier_score, input.ev_threshold]
  );
  return row!;
}

export async function getLatestCalibrationModel(): Promise<CalibrationModel | null> {
  return queryOne<CalibrationModel>(
    `SELECT * FROM calibration_model ORDER BY fitted_at DESC LIMIT 1`
  );
}

// (confidence, correct) pairs for fitting — graded attempts with a stated confidence.
export async function getCalibrationSamples(): Promise<{ confidence: number; correct: boolean }[]> {
  return query<{ confidence: number; correct: boolean }>(
    `SELECT confidence, is_correct AS correct
     FROM attempt
     WHERE confidence IS NOT NULL AND is_correct IS NOT NULL`
  );
}

export interface ConfidenceBucket {
  confidence: number;
  n: number;
  correct: number;
  accuracy: number;
}

// G2 — observed accuracy per stated confidence level, for the calibration curve.
export async function getConfidenceAccuracy(): Promise<ConfidenceBucket[]> {
  return query<ConfidenceBucket>(
    `SELECT confidence,
            count(*)::int AS n,
            count(*) FILTER (WHERE is_correct)::int AS correct,
            avg(CASE WHEN is_correct THEN 1.0 ELSE 0.0 END)::float AS accuracy
     FROM attempt
     WHERE confidence IS NOT NULL AND is_correct IS NOT NULL
     GROUP BY confidence
     ORDER BY confidence`
  );
}
