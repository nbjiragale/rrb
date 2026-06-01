// The vendor-neutral shape the importer consumes. lib/testbook/resultAdapter.ts
// is the ONLY place that knows Testbook's raw JSON; everything downstream (the
// import service, queries) speaks this contract. Swap the adapter to onboard a
// different provider without touching the write path (Open/Closed).

export type ItemStatus = "correct" | "incorrect" | "skipped";

export interface NormalizedItem {
  /** Testbook's stable question id. */
  externalQId: string;
  /** Provider-scoped ref stored on question.external_ref: `testbook:q:<id>`. */
  externalRef: string;
  qNo: number;
  /** Raw Testbook topic tag (first), resolved to a concept by the import service. */
  tag: string | null;
  stem: string;
  options: string[];
  /** Decoded worked solution, grounds the tutor/diagnosis. May be empty. */
  explanation: string;
  /** Cohort-derived hardness 0..1 (share of attempters who got it wrong). */
  difficulty: number;
  /** 0-based index into options. */
  correctOption: number;
  /** 0-based index, or null when skipped. */
  chosenOption: number | null;
  status: ItemStatus;
  timeSec: number;
  posMarks: number;
  negMarks: number;
  /** Cohort average seconds on this question — the difficulty/pacing benchmark. */
  cohortAvgTimeSec: number | null;
  /** Wrong AND answered far faster than the cohort → likely a rushed trap. */
  rushed: boolean;
}

export interface NormalizedMock {
  /** Testbook test id when known (URL-derived), else null. */
  externalTestId: string | null;
  /** Idempotency key stored on mock_session.external_ref. */
  externalRef: string;
  title: string;
  /** Exam target, e.g. "RRB NTPC". */
  target: string | null;
  /** Negative-mark ratio derived from the items (penalty/positive), e.g. 0.33. */
  negRatio: number;
  totalQuestions: number;
  /** ISO timestamp of the attempt. */
  takenAt: string | null;
  totalTimeSec: number | null;
  items: NormalizedItem[];
}
