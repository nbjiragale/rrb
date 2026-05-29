import { withTransaction } from "@/lib/db/client";
import { getExamConfig } from "@/lib/db/queries/examConfig";
import { getQuestionsBySubject, getQuestionsForGrading } from "@/lib/db/queries/questions";
import { createMockSession, completeMockSession } from "@/lib/db/queries/mocks";
import { applyAttemptTx } from "@/lib/services/attempt";
import { scoreMock, perQuestionMs, type PacingPoint, type MockScore } from "@/lib/scoring";
import { MOCK_SECONDS_PER_QUESTION } from "@/lib/config";
import type { MockType, PracticeQuestion, Subject } from "@/lib/db/types";

const SUBJECTS: Subject[] = ["math", "reasoning", "ga"];

function subjectForSection(name: string): Subject | null {
  const n = name.toLowerCase();
  if (n.includes("math")) return "math";
  if (n.includes("reason") || n.includes("intelligence") || n.includes("aptitude")) return "reasoning";
  if (n.includes("aware") || n.includes("general")) return "ga";
  return null;
}

export interface StartedMock {
  sessionId: number;
  questions: PracticeQuestion[];
  timeLimitS: number;
  negRatio: number;
}

// D1/D2 — assemble a mock from verified questions per the exam config.
export async function startMock(input: {
  type: MockType;
  subject?: Subject;
}): Promise<StartedMock> {
  const exam = await getExamConfig();
  if (!exam) throw new Error("Configure the exam (sections) before starting a mock.");

  const wanted: { subject: Subject; count: number; timeS: number }[] = [];

  if (input.type === "sectional") {
    if (!input.subject) throw new Error("Sectional mock requires a subject.");
    const section = exam.sections.find((s) => subjectForSection(s.name) === input.subject);
    wanted.push({
      subject: input.subject,
      count: section?.questions ?? 30,
      timeS: section?.time_s ?? 0,
    });
  } else {
    for (const s of exam.sections) {
      const subject = subjectForSection(s.name);
      if (subject) wanted.push({ subject, count: s.questions, timeS: s.time_s });
    }
    // Fallback if section names didn't map: a small slice of each subject.
    if (wanted.length === 0) {
      for (const subject of SUBJECTS) wanted.push({ subject, count: 10, timeS: 0 });
    }
  }

  const groups = await Promise.all(wanted.map((w) => getQuestionsBySubject(w.subject, w.count)));
  const questions = groups.flat();
  if (questions.length === 0) {
    throw new Error("No verified questions available — ingest PYQs first.");
  }

  const configuredTime = wanted.reduce((sum, w) => sum + w.timeS, 0);
  const timeLimitS = configuredTime > 0 ? configuredTime : questions.length * MOCK_SECONDS_PER_QUESTION;

  const sessionId = await createMockSession({
    type: input.type,
    total_questions: questions.length,
    time_limit_s: timeLimitS,
  });

  return { sessionId, questions, timeLimitS, negRatio: exam.negative_mark_ratio };
}

export interface TopicBreakdown {
  topic: string;
  correct: number;
  wrong: number;
  skipped: number;
  accuracy: number;
}

export interface MockAnalysis extends MockScore {
  byTopic: TopicBreakdown[];
  perQuestionMs: number[];
}

// D3/D4/D5 — grade server-side, log every attempt (skips first-class), persist
// the session, and return the breakdown.
export async function submitMock(input: {
  sessionId: number;
  answers: { questionId: number; selectedOption: number | null }[];
  pacing: PacingPoint[];
}): Promise<MockAnalysis> {
  const exam = await getExamConfig();
  const negRatio = exam?.negative_mark_ratio ?? 1 / 3;

  const grading = await getQuestionsForGrading(input.answers.map((a) => a.questionId));
  const byId = new Map(grading.map((g) => [g.id, g]));

  const scored = input.answers.map((a) => {
    const g = byId.get(a.questionId);
    if (!g) throw new Error(`Question ${a.questionId} not found or not verified`);
    return {
      ...a,
      conceptId: g.concept_id,
      topic: g.topic,
      isCorrect: a.selectedOption === null ? null : a.selectedOption === g.correct_option,
    };
  });

  const score = scoreMock(
    scored.map((s) => ({ selectedOption: s.selectedOption, isCorrect: s.isCorrect === true })),
    negRatio
  );

  await withTransaction(async (tx) => {
    for (const s of scored) {
      await applyAttemptTx(tx, {
        questionId: s.questionId,
        conceptId: s.conceptId,
        mockSessionId: input.sessionId,
        selectedOption: s.selectedOption,
        isCorrect: s.isCorrect,
        confidence: null,
        timeMs: null,
        context: "mock",
      });
    }
    await completeMockSession(
      input.sessionId,
      {
        attempted_count: score.attempted,
        score: score.score,
        accuracy: score.accuracy,
        pacing_data: input.pacing,
      },
      tx
    );
  });

  return { ...score, byTopic: breakdownByTopic(scored), perQuestionMs: perQuestionMs(input.pacing) };
}

function breakdownByTopic(
  scored: { topic: string; selectedOption: number | null; isCorrect: boolean | null }[]
): TopicBreakdown[] {
  const map = new Map<string, TopicBreakdown>();
  for (const s of scored) {
    const t = map.get(s.topic) ?? { topic: s.topic, correct: 0, wrong: 0, skipped: 0, accuracy: 0 };
    if (s.selectedOption === null) t.skipped++;
    else if (s.isCorrect) t.correct++;
    else t.wrong++;
    map.set(s.topic, t);
  }
  for (const t of map.values()) {
    const attempted = t.correct + t.wrong;
    t.accuracy = attempted === 0 ? 0 : t.correct / attempted;
  }
  return [...map.values()].sort((a, b) => a.accuracy - b.accuracy); // weakest first
}
