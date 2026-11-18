export type SummaryLength = "short" | "medium" | "long";

export interface KeyTerm {
  term: string;
  score: number;
  example: string;
}

export interface Flashcard {
  front: string;
  back: string;
  source: string;
  kind: "definition" | "concept";
}

export interface QuizQuestion {
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
}

export interface AnalysisResult {
  title: string;
  stats: { words: number; sentences: number; reading_minutes: number };
  summary: string[];
  key_terms: KeyTerm[];
  flashcards: Flashcard[];
  quiz: QuizQuestion[];
  source_text: string;
}

/** A saved study set, stored in the browser. */
export interface StudySet extends AnalysisResult {
  id: string;
  createdAt: string;
  length: SummaryLength;
  /** Indexes of flashcards the learner marked as known. */
  known: number[];
  bestScore: number | null;
}
