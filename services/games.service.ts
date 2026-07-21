import api from "@/lib/api-client";

export type Game = {
  id: number;
  name: string;
  path: string;
  unlock: number;
  unlocked: boolean;
  levelsLeft: number;
};

export type GameWord = {
  id: number;
  title: string;
  src: string | null;
  answered: boolean;
};

export type FlashcardOption = {
  name: string;
  marked: boolean;
};

export type Flashcard = {
  title: string;
  src: string | null;
  options: FlashcardOption[];
  correct: number;
  answered: boolean;
};

export type DotaxiQuestion = {
  id: number;
  text: string;
  options: string[];
  correct: string;
};

export async function getGamesService(): Promise<Game[]> {
  try {
    const { data } = await api.get<Game[]>("/games");
    return data;
  } catch {
    return [];
  }
}

export async function getGameWordsService(): Promise<GameWord[]> {
  const { data } = await api.get<GameWord[]>("/games/words");
  return data;
}

export async function getFlashcardsService(): Promise<Flashcard[]> {
  const { data } = await api.get<Flashcard[]>("/games/flashcards");
  return data;
}

export async function getDontPopService(): Promise<GameWord[]> {
  const { data } = await api.get<GameWord[]>("/games/dont-pop");
  return data;
}

export async function getDotaxiService(): Promise<DotaxiQuestion[]> {
  const { data } = await api.get<DotaxiQuestion[]>("/games/dotaxi");
  return data;
}

// ── True-False (¿Verdad o Trampa?) ────────────────────────────────────────────

export type TrueFalseCard = {
  id: number;
  en: string;
  es: string;
  isCorrect: boolean;
  /** Real Spanish meaning — only present on trap cards. */
  realEs?: string;
};

export async function getTrueFalseService(
  seed?: number,
): Promise<TrueFalseCard[]> {
  const params = seed !== undefined ? { params: { seed } } : {};
  const { data } = await api.get<TrueFalseCard[]>("/games/true-false", params);
  return data;
}
