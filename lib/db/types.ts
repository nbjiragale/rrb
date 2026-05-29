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
