// Row types kept in sync with migrations/0001_v1_init.sql.

export type Subject = "math" | "reasoning" | "ga";
export type CardType = "recall" | "cloze" | "mcq";
export type CardState = "new" | "learning" | "review" | "relearning";

export interface Concept {
  id: number;
  name: string;
  subject: Subject;
  topic: string;
  subtopic: string | null;
  parent_id: number | null;
  description: string | null;
  exam_weight: number;
  created_at: string;
}

export interface Card {
  id: number;
  concept_id: number;
  front: string;
  back: string;
  card_type: CardType;
  source_ref: string | null;
  stability: number | null;
  difficulty: number | null;
  state: CardState;
  due_at: string | null;
  last_review: string | null;
  reps: number;
  lapses: number;
  created_at: string;
}

// A card joined with its concept name/subject, for the review queue.
export interface DueCard extends Card {
  concept_name: string;
  subject: Subject;
  topic: string;
}

// FSRS ratings map 1..4 → again/hard/good/easy.
export type Rating = 1 | 2 | 3 | 4;

export interface ExamConfig {
  id: number;
  exam_name: string;
  exam_date: string | null;
  negative_mark_ratio: number;
  locale: string;
  sections: { name: string; questions: number; marks: number; time_s: number }[];
  created_at: string;
}

export type QuestionSource = "pyq" | "ai_generated" | "adversarial";
export type AttemptContext = "mock" | "practice" | "feynman" | "quiz";
export type MasteryLevel = "new" | "learning" | "review" | "mastered";
export type Confidence = 1 | 2 | 3 | 4 | 5;

export interface Question {
  id: number;
  concept_id: number;
  stem: string;
  options: string[];
  correct_option: number;
  explanation: string | null;
  difficulty: number;
  source: QuestionSource;
  is_adversarial: boolean;
  parent_question_id: number | null;
  exam_year: number | null;
  exam_stage: string | null;
  gen_source: string | null;
  verified: boolean;
  created_at: string;
}

// A question as served to the learner — never includes the answer/explanation.
export type PracticeQuestion = Pick<Question, "id" | "concept_id" | "stem" | "options">;

export interface ConceptMastery {
  concept_id: number;
  attempts: number;
  correct: number;
  wrong: number;
  p_known: number;
  avg_confidence: number | null;
  calibration_error: number | null;
  mastery_level: MasteryLevel;
  last_seen_at: string | null;
  last_correct_at: string | null;
}
