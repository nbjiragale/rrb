"use server";

import { refitCalibration } from "@/lib/services/calibration";

export interface RefitState {
  ok: boolean;
  message: string;
}

// Manual trigger so the EV trainer is usable without waiting for the nightly run.
export async function refitCalibrationAction(): Promise<RefitState> {
  const r = await refitCalibration();
  if (!r.fitted) {
    return {
      ok: false,
      message: `Not enough graded attempts yet (have ${r.nSamples}; need ≥ 5). Keep practising.`,
    };
  }
  return {
    ok: true,
    message: `Refit on ${r.nSamples} attempts. ${
      r.evThreshold != null ? `Attempt when confidence ≥ ${r.evThreshold.toFixed(1)}/5.` : ""
    }`,
  };
}
