import {
  fsrs,
  generatorParameters,
  createEmptyCard,
  Rating as FsrsRating,
  State as FsrsState,
  type Card as FsrsCard,
  type Grade,
} from "ts-fsrs";
import type { Card, CardState, Rating } from "@/lib/db/types";

// Single shared scheduler. FSRS (not SM-2) per CLAUDE.md §7 / build brief §3.
const scheduler = fsrs(generatorParameters({ enable_fuzz: true }));

const STATE_TO_FSRS: Record<CardState, FsrsState> = {
  new: FsrsState.New,
  learning: FsrsState.Learning,
  review: FsrsState.Review,
  relearning: FsrsState.Relearning,
};

const FSRS_TO_STATE: Record<FsrsState, CardState> = {
  [FsrsState.New]: "new",
  [FsrsState.Learning]: "learning",
  [FsrsState.Review]: "review",
  [FsrsState.Relearning]: "relearning",
};

const RATING_TO_FSRS: Record<Rating, Grade> = {
  1: FsrsRating.Again,
  2: FsrsRating.Hard,
  3: FsrsRating.Good,
  4: FsrsRating.Easy,
};

// Rebuild an ts-fsrs card object from our persisted columns.
function toFsrsCard(card: Card, now: Date): FsrsCard {
  if (card.state === "new" || card.stability == null || card.difficulty == null) {
    return createEmptyCard(now);
  }
  return {
    due: card.due_at ? new Date(card.due_at) : now,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: card.reps,
    lapses: card.lapses,
    state: STATE_TO_FSRS[card.state],
    last_review: card.last_review ? new Date(card.last_review) : undefined,
  };
}

export interface ScheduleResult {
  stability: number;
  difficulty: number;
  state: CardState;
  due_at: Date;
  last_review: Date;
  reps: number;
  lapses: number;
}

// Given a card and a rating, return the next FSRS state. Pure — no DB.
export function schedule(card: Card, rating: Rating, now = new Date()): ScheduleResult {
  const fsrsCard = toFsrsCard(card, now);
  const next = scheduler.next(fsrsCard, now, RATING_TO_FSRS[rating]);
  const c = next.card;
  return {
    stability: c.stability,
    difficulty: c.difficulty,
    state: FSRS_TO_STATE[c.state],
    due_at: c.due,
    last_review: now,
    reps: c.reps,
    lapses: c.lapses,
  };
}
