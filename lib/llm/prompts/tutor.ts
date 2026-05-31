import type { ConceptMastery } from "@/lib/db/types";
import type { RecentError } from "@/lib/db/queries/attempts";
import type { SemanticMatch } from "@/lib/db/queries/interactions";
import type { ContrastConcept } from "@/lib/db/queries/edges";

// Pure prompt construction — no I/O. The service assembles the inputs.

// E4 — a contrast partner is "weak" (worth disambiguating) below this mastery.
export const CONTRAST_WEAK_THRESHOLD = 0.5;

export interface TutorContext {
  conceptName: string;
  conceptDescription: string | null;
  mastery: ConceptMastery | null;
  recentErrors: RecentError[];
  semanticMatches: SemanticMatch[];
  contrasts: ContrastConcept[];
}

const PROFILE_STUB =
  "No nightly learner profile yet. Treat the learner as a focused RRB NTPC aspirant; tailor depth to the per-concept mastery below.";

export function buildTutorSystemPrompt(): string {
  return [
    "You are a patient, precise tutor for India's RRB NTPC exam.",
    "Teach to the learner's actual gap shown in the [MEMORY] block — be concise and concrete, and prefer worked reasoning over generic advice.",
    "Lean on what the learner already knows and directly address the specific recent mistakes listed.",
    "Ground general-awareness facts in well-established knowledge; if you are unsure of a fact, say so plainly rather than guessing.",
  ].join(" ");
}

// The stable, cacheable prefix (§8): persona + the nightly learner profile.
// Both change at most once a day, so they earn a prompt-cache breakpoint while
// the per-concept [MEMORY] slice (built below) stays volatile and uncached.
export function buildTutorCachedPrefix(profileSummary: string | null): string {
  return `${buildTutorSystemPrompt()}\n\n[PROFILE]\n${profileSummary ?? PROFILE_STUB}`;
}

// The selectively-retrieved memory slice (Hard Rule §7 — never dump everything).
export function buildTutorMemoryBlock(ctx: TutorContext): string {
  const lines: string[] = [];
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

  // J2 (v5) — the learner's own past words, recalled semantically, for continuity.
  if (ctx.semanticMatches.length > 0) {
    lines.push("Relevant past notes from the learner:");
    for (const m of ctx.semanticMatches) {
      lines.push(`- (${m.type}) ${m.content.slice(0, 240)}`);
    }
  }

  // E4 — surface the concept the learner confuses this with WHEN that partner is
  // itself weak (the likely root of the mix-up). The tutor is told to contrast
  // the pair explicitly.
  const weakContrasts = ctx.contrasts.filter((c) => c.p_known < CONTRAST_WEAK_THRESHOLD);
  if (weakContrasts.length > 0) {
    lines.push("Easily confused with (and currently weak — contrast these explicitly):");
    for (const c of weakContrasts) {
      lines.push(`- ${c.name} (p_known=${c.p_known.toFixed(2)})`);
    }
  }

  return lines.join("\n");
}
