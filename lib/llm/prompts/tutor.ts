import type { ConceptMastery } from "@/lib/db/types";
import type { RecentError } from "@/lib/db/queries/attempts";

// Pure prompt construction — no I/O. The service assembles the inputs.

export interface TutorContext {
  conceptName: string;
  conceptDescription: string | null;
  profileSummary: string | null;
  mastery: ConceptMastery | null;
  recentErrors: RecentError[];
}

const PROFILE_STUB =
  "Learner profile generation arrives in v5. For now treat the learner as a focused RRB NTPC aspirant; tailor depth to the per-concept mastery below.";

export function buildTutorSystemPrompt(): string {
  return [
    "You are a patient, precise tutor for India's RRB NTPC exam.",
    "Teach to the learner's actual gap shown in the [MEMORY] block — be concise and concrete, and prefer worked reasoning over generic advice.",
    "Lean on what the learner already knows and directly address the specific recent mistakes listed.",
    "Ground general-awareness facts in well-established knowledge; if you are unsure of a fact, say so plainly rather than guessing.",
  ].join(" ");
}

// The selectively-retrieved memory slice (Hard Rule §7 — never dump everything).
export function buildTutorMemoryBlock(ctx: TutorContext): string {
  const lines: string[] = [];
  lines.push(`Profile: ${ctx.profileSummary ?? PROFILE_STUB}`);
  lines.push(
    `Concept: ${ctx.conceptName}${ctx.conceptDescription ? ` — ${ctx.conceptDescription}` : ""}`
  );

  lines.push(
    ctx.mastery
      ? `Mastery: ${ctx.mastery.attempts} attempts, ${ctx.mastery.correct} correct, ` +
          `p_known=${ctx.mastery.p_known.toFixed(2)}, level=${ctx.mastery.mastery_level}.`
      : "Mastery: no attempts yet on this concept (treat as new)."
  );

  if (ctx.recentErrors.length > 0) {
    lines.push("Recent mistakes:");
    for (const e of ctx.recentErrors) {
      const chose = e.selected_text ? `chose "${e.selected_text}"` : "skipped";
      lines.push(`- ${e.stem} — ${chose}; correct was "${e.correct_text}".`);
    }
  }

  return lines.join("\n");
}
