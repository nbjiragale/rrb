import { z } from "zod";
import { decodeTestbookHtml } from "./decode.ts";
import type { ItemStatus, NormalizedItem, NormalizedMock } from "./types.ts";

// Loose schema over the Testbook `studenttestresult` payload: validate only the
// fields we consume and tolerate everything else (Testbook ships many extra
// keys, and they vary by test type). Fail fast if the core shape is missing.
const optionSchema = z.object({ prompt: z.string(), value: z.string() });

const responseSchema = z.object({
  answer: z.object({
    correctOption: z.string().optional().default(""),
    posMarks: z.number().optional(),
    negMarks: z.number().optional(),
    studentResStatus: z.string().optional().default(""),
    studentResponse: z
      .object({ markedOption: z.string().optional(), time: z.number().optional() })
      .nullish(),
    tags: z.array(z.string()).nullish(),
    sol: z.object({ value: z.string().optional() }).nullish(),
    stats: z
      .object({
        averageTime: z.number().optional(),
        attempts: z
          .object({ correct: z.number().optional(), incorrect: z.number().optional() })
          .nullish(),
      })
      .nullish(),
  }),
  question: z.object({
    _id: z.string(),
    QSNo: z.number().optional(),
    ques: z.object({ value: z.string().optional().default(""), options: z.array(optionSchema).default([]) }),
    tags: z.array(z.string()).nullish(),
  }),
});

const payloadSchema = z.object({
  data: z.object({
    title: z.string().optional().default("Untitled mock"),
    totalQuestions: z.number().optional(),
    totalTimeSpent: z.number().optional(),
    attemptedOn: z.string().optional(),
    target: z.array(z.object({ title: z.string() })).nullish(),
    sections: z.array(z.object({ responses: z.array(responseSchema).default([]) })).default([]),
  }),
});

/** Items answered at least this fraction faster than the cohort, and wrong, are flagged rushed. */
const RUSHED_RATIO = 0.5;

export interface AdaptOptions {
  /** URL-derived test id (the body doesn't carry it); strengthens the dedupe key. */
  externalTestId?: string | null;
}

// Pure: raw Testbook JSON → vendor-neutral NormalizedMock. Throws on a payload
// missing the per-question structure we depend on.
export function adaptStudentTestResult(raw: unknown, opts: AdaptOptions = {}): NormalizedMock {
  const { data } = payloadSchema.parse(raw);
  const responses = data.sections.flatMap((s) => s.responses);
  if (responses.length === 0) {
    throw new Error("Testbook payload has no question responses.");
  }

  const items = responses.map((r, i) => adaptItem(r, i));

  const negRatio = deriveNegRatio(items);
  const externalTestId = opts.externalTestId ?? null;

  return {
    externalTestId,
    externalRef: buildMockRef(externalTestId, data.attemptedOn),
    title: data.title,
    target: data.target?.[0]?.title ?? null,
    negRatio,
    totalQuestions: data.totalQuestions ?? items.length,
    takenAt: data.attemptedOn ?? null,
    totalTimeSec: data.totalTimeSpent ?? null,
    items,
  };
}

function adaptItem(r: z.infer<typeof responseSchema>, idx: number): NormalizedItem {
  const opts = r.question.ques.options;
  const options = opts.map((o) => decodeTestbookHtml(o.value));

  const indexOfPrompt = (prompt: string | undefined): number => {
    if (!prompt) return -1;
    return opts.findIndex((o) => o.prompt === prompt);
  };

  const correctOption = indexOfPrompt(r.answer.correctOption);
  const marked = r.answer.studentResponse?.markedOption;
  const chosenRaw = indexOfPrompt(marked);
  const chosenOption = chosenRaw >= 0 ? chosenRaw : null;

  const status = deriveStatus(r.answer.studentResStatus, chosenOption, correctOption);
  const timeSec = r.answer.studentResponse?.time ?? 0;
  const cohortAvgTimeSec = r.answer.stats?.averageTime ?? null;

  return {
    externalQId: r.question._id,
    externalRef: `testbook:q:${r.question._id}`,
    qNo: r.question.QSNo ?? idx + 1,
    tag: (r.answer.tags ?? r.question.tags ?? [])[0] ?? null,
    stem: decodeTestbookHtml(r.question.ques.value),
    options,
    explanation: decodeTestbookHtml(r.answer.sol?.value),
    difficulty: cohortDifficulty(r.answer.stats?.attempts),
    correctOption,
    chosenOption,
    status,
    timeSec,
    posMarks: r.answer.posMarks ?? 1,
    negMarks: r.answer.negMarks ?? 0,
    cohortAvgTimeSec,
    rushed:
      status === "incorrect" &&
      timeSec > 0 &&
      cohortAvgTimeSec != null &&
      cohortAvgTimeSec > 0 &&
      timeSec < RUSHED_RATIO * cohortAvgTimeSec,
  };
}

// Prefer Testbook's explicit status; fall back to comparing chosen vs correct.
function deriveStatus(
  rawStatus: string,
  chosenOption: number | null,
  correctOption: number
): ItemStatus {
  const s = rawStatus.trim().toLowerCase();
  if (s === "correct") return "correct";
  if (s === "incorrect" || s === "wrong") return "incorrect";
  if (s === "unattempted" || s === "skipped" || s === "") {
    if (chosenOption === null) return "skipped";
  }
  if (chosenOption === null) return "skipped";
  return chosenOption === correctOption ? "correct" : "incorrect";
}

// Cohort hardness: fraction of attempters (correct + incorrect) who got it
// wrong. Defaults to 0.5 when the cohort breakdown is absent.
function cohortDifficulty(
  attempts: { correct?: number; incorrect?: number } | null | undefined
): number {
  const correct = attempts?.correct ?? 0;
  const incorrect = attempts?.incorrect ?? 0;
  const attempted = correct + incorrect;
  if (attempted === 0) return 0.5;
  return incorrect / attempted;
}

// Most items share one marking scheme; take the first with positive marks.
function deriveNegRatio(items: NormalizedItem[]): number {
  const withMarks = items.find((it) => it.posMarks > 0);
  if (!withMarks) return 1 / 3;
  return withMarks.negMarks / withMarks.posMarks;
}

function buildMockRef(testId: string | null, attemptedOn: string | undefined): string {
  const anchor = attemptedOn ?? "unknown";
  return testId ? `testbook:test:${testId}:att:${anchor}` : `testbook:att:${anchor}`;
}
