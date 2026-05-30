import { complete, isLlmConfigured } from "@/lib/llm/router";
import {
  buildProfileSystemPrompt,
  buildProfileUserPrompt,
  buildFocusAreas,
  type ProfileInputs,
} from "@/lib/llm/prompts/profile";
import { getMasteryCounts, getWeakConcepts } from "@/lib/db/queries/mastery";
import { countDue } from "@/lib/db/queries/cards";
import { getRecurringMisconceptions } from "@/lib/db/queries/misconceptions";
import { getExamConfig } from "@/lib/db/queries/examConfig";
import { getLatestCalibrationModel } from "@/lib/db/queries/calibration";
import { insertLearnerProfile } from "@/lib/db/queries/learnerProfile";
import type { LearnerProfile } from "@/lib/db/types";

// Nightly (walkthrough C.3): regenerate the learner profile paragraph from the
// latest derived state. Returns null when the LLM isn't configured.
export async function regenerateProfile(): Promise<LearnerProfile | null> {
  if (!isLlmConfigured()) return null;

  const [counts, weak, due, misconceptions, config, calibration] = await Promise.all([
    getMasteryCounts(),
    getWeakConcepts(5),
    countDue(),
    getRecurringMisconceptions(),
    getExamConfig(),
    getLatestCalibrationModel(),
  ]);

  const daysToExam = config?.exam_date
    ? Math.max(0, Math.ceil((new Date(config.exam_date).getTime() - Date.now()) / 86_400_000))
    : null;

  const calibrationNote =
    calibration?.ev_threshold != null
      ? `attempt only when confidence ≥ ${calibration.ev_threshold.toFixed(1)}/5 (break-even under negative marking)`
      : null;

  const inputs: ProfileInputs = {
    masteredCount: counts.mastered,
    trackedCount: counts.tracked,
    totalAttempts: counts.attempts,
    dueReviews: due.due,
    weakConcepts: weak.map((w) => w.name),
    recurringMisconceptions: misconceptions
      .slice(0, 5)
      .map((m) => `${m.label.replace(/_/g, " ")} (×${m.hit_count})`),
    daysToExam,
    calibration: calibrationNote,
  };

  const summary = await complete({
    system: buildProfileSystemPrompt(),
    messages: [{ role: "user", content: buildProfileUserPrompt(inputs) }],
    task: "tutor",
    maxTokens: 400,
  });

  return insertLearnerProfile({
    summary_text: summary,
    focus_areas: buildFocusAreas(inputs),
    snapshot: { ...counts, dueReviews: due.due, daysToExam },
  });
}
