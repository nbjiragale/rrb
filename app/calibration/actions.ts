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
      message: `Need a few more answers first — you have ${r.nSamples} of the 5 needed. Rate your confidence in Practice and check back.`,
    };
  }
  return {
    ok: true,
    message: `Updated from ${r.nSamples} answer${r.nSamples === 1 ? "" : "s"}.${
      r.evThreshold != null
        ? ` Worth attempting once you're at least ${r.evThreshold.toFixed(1)}/5 sure.`
        : ""
    }`,
  };
}
