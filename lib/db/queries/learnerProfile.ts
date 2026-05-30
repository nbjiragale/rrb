import { query, queryOne } from "@/lib/db/client";
import type { LearnerProfile, LearnerProfileFocus } from "@/lib/db/types";

// THE PROFILE: nightly one-paragraph summary injected into every tutor call.

export async function insertLearnerProfile(input: {
  summary_text: string;
  focus_areas: LearnerProfileFocus | null;
  snapshot: Record<string, unknown> | null;
}): Promise<LearnerProfile> {
  const row = await queryOne<LearnerProfile>(
    `INSERT INTO learner_profile (summary_text, focus_areas, snapshot)
     VALUES ($1, $2::jsonb, $3::jsonb)
     RETURNING *`,
    [
      input.summary_text,
      input.focus_areas ? JSON.stringify(input.focus_areas) : null,
      input.snapshot ? JSON.stringify(input.snapshot) : null,
    ]
  );
  return row!;
}

export async function getLatestProfile(): Promise<LearnerProfile | null> {
  return queryOne<LearnerProfile>(
    `SELECT * FROM learner_profile ORDER BY generated_at DESC LIMIT 1`
  );
}
