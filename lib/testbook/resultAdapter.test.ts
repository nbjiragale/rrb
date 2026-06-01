import { test } from "node:test";
import assert from "node:assert/strict";
import { adaptStudentTestResult } from "./resultAdapter.ts";

const OPTIONS = [
  { prompt: "1", value: "18 kmph" },
  { prompt: "2", value: "36 kmph" },
  { prompt: "3", value: "44 kmph" },
  { prompt: "4", value: "28 kmph" },
];

function response(over: {
  id: string;
  qsno: number;
  correct: string;
  marked?: string;
  status: string;
  time: number;
  avgTime?: number;
  correctCount?: number;
  incorrectCount?: number;
  tag?: string;
}) {
  return {
    answer: {
      correctOption: over.correct,
      posMarks: 1,
      negMarks: 0.33,
      studentResStatus: over.status,
      studentResponse: over.marked ? { markedOption: over.marked, time: over.time } : { time: over.time },
      tags: over.tag ? [over.tag] : [],
      sol: { value: "<p>Because &amp;radic;9 = 3</p>" },
      stats: {
        averageTime: over.avgTime ?? 50,
        attempts: { correct: over.correctCount ?? 80, incorrect: over.incorrectCount ?? 20 },
      },
    },
    question: {
      _id: over.id,
      QSNo: over.qsno,
      ques: { value: `<p>Question ${over.qsno}</p>`, options: OPTIONS },
    },
  };
}

const PAYLOAD = {
  data: {
    title: "RRB NTPC Practice",
    totalQuestions: 3,
    totalTimeSpent: 105,
    attemptedOn: "2026-06-01T04:19:56Z",
    target: [{ title: "RRB NTPC" }],
    sections: [
      {
        responses: [
          response({ id: "q1", qsno: 1, correct: "2", marked: "2", status: "Correct", time: 40, tag: "Speed Time and Distance" }),
          response({ id: "q2", qsno: 2, correct: "2", marked: "3", status: "Incorrect", time: 5, avgTime: 74, correctCount: 50, incorrectCount: 50, tag: "Speed Time and Distance" }),
          response({ id: "q3", qsno: 3, correct: "1", status: "Unattempted", time: 0, tag: "Polity" }),
        ],
      },
    ],
  },
};

test("maps options, correct/chosen to 0-based indices", () => {
  const mock = adaptStudentTestResult(PAYLOAD);
  assert.equal(mock.items.length, 3);
  assert.equal(mock.items[0].correctOption, 1); // prompt "2" → index 1
  assert.equal(mock.items[0].chosenOption, 1);
  assert.equal(mock.items[1].chosenOption, 2); // prompt "3" → index 2
  assert.equal(mock.items[2].chosenOption, null); // skipped
});

test("derives status from Testbook's label", () => {
  const mock = adaptStudentTestResult(PAYLOAD);
  assert.equal(mock.items[0].status, "correct");
  assert.equal(mock.items[1].status, "incorrect");
  assert.equal(mock.items[2].status, "skipped");
});

test("flags a wrong answer far faster than the cohort as rushed", () => {
  const mock = adaptStudentTestResult(PAYLOAD);
  assert.equal(mock.items[1].rushed, true); // 5s vs 74s cohort
  assert.equal(mock.items[0].rushed, false); // correct
});

test("difficulty is the cohort wrong-share among attempters", () => {
  const mock = adaptStudentTestResult(PAYLOAD);
  assert.equal(mock.items[0].difficulty, 0.2); // 20 wrong / 100
  assert.equal(mock.items[1].difficulty, 0.5); // 50 / 100
});

test("decodes stem and solution html", () => {
  const mock = adaptStudentTestResult(PAYLOAD);
  assert.equal(mock.items[0].stem, "Question 1");
  assert.equal(mock.items[0].explanation, "Because √9 = 3");
});

test("derives negRatio and per-question external ref", () => {
  const mock = adaptStudentTestResult(PAYLOAD);
  assert.ok(Math.abs(mock.negRatio - 0.33) < 1e-9);
  assert.equal(mock.items[0].externalRef, "testbook:q:q1");
});

test("external ref includes the test id when supplied, attempt timestamp always", () => {
  const withId = adaptStudentTestResult(PAYLOAD, { externalTestId: "T123" });
  assert.equal(withId.externalRef, "testbook:test:T123:att:2026-06-01T04:19:56Z");
  const without = adaptStudentTestResult(PAYLOAD);
  assert.equal(without.externalRef, "testbook:att:2026-06-01T04:19:56Z");
});

test("throws on a payload with no responses", () => {
  assert.throws(() => adaptStudentTestResult({ data: { sections: [] } }), /no question responses/);
});
