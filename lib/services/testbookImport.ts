import { withTransaction } from "@/lib/db/client";
import { getConceptResolveList } from "@/lib/db/queries/concepts";
import { getTagMap } from "@/lib/db/queries/testbookTags";
import { findQuestionByExternalRef, createImportedQuestion } from "@/lib/db/queries/questions";
import { findMockByExternalRef, createImportedMockSession } from "@/lib/db/queries/mocks";
import { applyAttemptTx } from "@/lib/services/attempt";
import { buildTagResolver } from "@/lib/testbook/conceptResolver";
import { adaptStudentTestResult } from "@/lib/testbook/resultAdapter";
import type { NormalizedItem, NormalizedMock } from "@/lib/testbook/types";
import type { MockType } from "@/lib/db/types";

// Imports one Testbook full-mock result (the `studenttestresult` payload) into
// the learner's own data: one mock_session + an immutable `attempt` per question,
// each folded into BKT mastery via the shared write path (architecture §9).
//
// Idempotent on the mock's external_ref. Concept resolution is conservative — an
// unmapped/ambiguous tag is surfaced, never guessed, so BKT is never poisoned by
// a mis-attributed attempt. Wrong attempts need no special wiring here: they land
// in `attempt` with no misconception_hit, so the existing nightly diagnosis
// safety net (diagnosePending) picks them up and runs the v4 "why" classifier.

export interface UnmappedTag {
  tag: string;
  count: number;
}

export interface TopicOutcome {
  tag: string;
  correct: number;
  wrong: number;
  skipped: number;
}

export interface TestbookImportResult {
  alreadyImported: boolean;
  mockSessionId: number;
  title: string;
  totalQuestions: number;
  imported: number; // attempts written
  skippedUnmapped: number; // questions dropped for want of a concept
  correct: number;
  wrong: number;
  unattempted: number;
  score: number;
  accuracy: number;
  rushed: number; // wrong + answered far faster than the cohort
  unmappedTags: UnmappedTag[];
  weakestTopics: TopicOutcome[]; // mapped topics, weakest first
}

export async function importTestbookMock(
  raw: unknown,
  opts: { externalTestId?: string | null } = {}
): Promise<TestbookImportResult> {
  const mock = adaptStudentTestResult(raw, { externalTestId: opts.externalTestId ?? null });

  const existingId = await findMockByExternalRef(mock.externalRef);
  if (existingId !== null) {
    return alreadyImportedResult(existingId, mock);
  }

  const [concepts, tagMap] = await Promise.all([getConceptResolveList(), getTagMap()]);
  const resolve = buildTagResolver(concepts, tagMap);

  // Resolve every item up front so we can split mapped vs unmapped and report
  // before touching the DB.
  const resolved = mock.items.map((it) => ({ item: it, conceptId: resolve(it.tag) }));
  const mapped = resolved.filter((r) => r.conceptId !== null) as {
    item: NormalizedItem;
    conceptId: number;
  }[];
  const unmapped = resolved.filter((r) => r.conceptId === null).map((r) => r.item);

  const stats = tallyOutcomes(mapped.map((m) => m.item));

  const mockSessionId = await withTransaction(async (tx) => {
    const sessionId = await createImportedMockSession(
      {
        type: classifyMock(mock.totalQuestions),
        external_ref: mock.externalRef,
        taken_at: mock.takenAt,
        total_questions: mock.totalQuestions,
        attempted_count: stats.correct + stats.wrong,
        score: stats.score,
        accuracy: stats.accuracy,
        total_time_s: mock.totalTimeSec,
        pacing_data: buildPacing(mapped.map((m) => m.item)),
      },
      tx
    );

    for (const { item, conceptId } of mapped) {
      const questionId = await ensureQuestion(item, conceptId, tx);
      await applyAttemptTx(tx, {
        questionId,
        conceptId,
        mockSessionId: sessionId,
        selectedOption: item.chosenOption,
        isCorrect: statusToCorrect(item.status),
        confidence: null, // imports can't recover pre-reveal confidence
        timeMs: item.timeSec > 0 ? item.timeSec * 1000 : null,
        context: "mock",
      });
    }

    return sessionId;
  });

  return {
    alreadyImported: false,
    mockSessionId,
    title: mock.title,
    totalQuestions: mock.totalQuestions,
    imported: mapped.length,
    skippedUnmapped: unmapped.length,
    correct: stats.correct,
    wrong: stats.wrong,
    unattempted: stats.skipped,
    score: stats.score,
    accuracy: stats.accuracy,
    rushed: mapped.filter((m) => m.item.rushed).length,
    unmappedTags: aggregateUnmapped(unmapped),
    weakestTopics: weakestTopics(mapped.map((m) => m.item)),
  };
}

// Find-or-create the question row for an imported item, threaded through the txn.
async function ensureQuestion(
  item: NormalizedItem,
  conceptId: number,
  tx: Parameters<Parameters<typeof withTransaction>[0]>[0]
): Promise<number> {
  const existing = await findQuestionByExternalRef(item.externalRef, tx);
  if (existing) return existing.id;
  return createImportedQuestion(
    {
      concept_id: conceptId,
      stem: item.stem,
      options: item.options,
      correct_option: item.correctOption,
      explanation: item.explanation || null,
      difficulty: item.difficulty,
      source: "testbook",
      external_ref: item.externalRef,
    },
    tx
  );
}

function statusToCorrect(status: NormalizedItem["status"]): boolean | null {
  if (status === "correct") return true;
  if (status === "incorrect") return false;
  return null; // skipped — no knowledge signal
}

// NTPC CBT1 is ~100 questions; anything smaller is treated as a sectional.
function classifyMock(totalQuestions: number): MockType {
  return totalQuestions >= 100 ? "full_cbt1" : "sectional";
}

interface Tally {
  correct: number;
  wrong: number;
  skipped: number;
  score: number;
  accuracy: number;
}

function tallyOutcomes(items: NormalizedItem[]): Tally {
  let correct = 0;
  let wrong = 0;
  let skipped = 0;
  let score = 0;
  for (const it of items) {
    if (it.status === "correct") {
      correct++;
      score += it.posMarks;
    } else if (it.status === "incorrect") {
      wrong++;
      score -= it.negMarks;
    } else {
      skipped++;
    }
  }
  const attempted = correct + wrong;
  return {
    correct,
    wrong,
    skipped,
    score: round2(score),
    accuracy: attempted === 0 ? 0 : round2(correct / attempted),
  };
}

function buildPacing(items: NormalizedItem[]): { q: number; cumulative_ms: number }[] {
  const ordered = [...items].sort((a, b) => a.qNo - b.qNo);
  let cumulative = 0;
  return ordered.map((it) => {
    cumulative += Math.max(0, it.timeSec) * 1000;
    return { q: it.qNo, cumulative_ms: cumulative };
  });
}

function aggregateUnmapped(items: NormalizedItem[]): UnmappedTag[] {
  const counts = new Map<string, number>();
  for (const it of items) {
    const tag = it.tag ?? "(untagged)";
    counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

function weakestTopics(items: NormalizedItem[]): TopicOutcome[] {
  const byTag = new Map<string, TopicOutcome>();
  for (const it of items) {
    const tag = it.tag ?? "(untagged)";
    const t = byTag.get(tag) ?? { tag, correct: 0, wrong: 0, skipped: 0 };
    if (it.status === "correct") t.correct++;
    else if (it.status === "incorrect") t.wrong++;
    else t.skipped++;
    byTag.set(tag, t);
  }
  return [...byTag.values()].sort(
    (a, b) => b.wrong + b.skipped - (a.wrong + a.skipped)
  );
}

function alreadyImportedResult(
  sessionId: number,
  mock: NormalizedMock
): TestbookImportResult {
  return {
    alreadyImported: true,
    mockSessionId: sessionId,
    title: mock.title,
    totalQuestions: mock.totalQuestions,
    imported: 0,
    skippedUnmapped: 0,
    correct: 0,
    wrong: 0,
    unattempted: 0,
    score: 0,
    accuracy: 0,
    rushed: 0,
    unmappedTags: [],
    weakestTopics: [],
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
