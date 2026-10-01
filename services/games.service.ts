import api from "@/lib/api-client";

// ── Global records (trono por juego) ─────────────────────────────────────────

export type GameRecord = {
  gameKey: string;
  holderName: string;
  holderId: number;
  highScore: number;
};

export async function getGameRecordsService(): Promise<GameRecord[]> {
  try {
    const { data } = await api.get<GameRecord[]>("/games/records");
    return data;
  } catch {
    return [];
  }
}

// ── Games list ────────────────────────────────────────────────────────────────

export type Game = {
  id: number;
  name: string;
  path: string;
  unlock: number;
  unlocked: boolean;
  levelsLeft: number;
  /** Abierto SOLO por ser el torneo de la semana: el lunes vuelve a cerrarse. */
  tournamentPass: boolean;
};

export type GameWord = {
  id: number;
  title: string;
  src: string | null;
  answered: boolean;
  /**
   * ¡No lo revientes!: otras palabras que también valen para esta imagen (las
   * que el admin aceptó, spec reportes §4); no salen como señuelo. Un backend
   * viejo no lo manda.
   */
  accepted?: string[];
};

export type DotaxiQuestion = {
  id: number;
  text: string;
  options: string[];
  correct: string;
};

// Propaga el error a propósito: la cuadrícula de /play distingue "no hay
// juegos" de "no pudimos cargarlos" y ofrece Reintentar.
export async function getGamesService(): Promise<Game[]> {
  const { data } = await api.get<Game[]>("/games");
  return data;
}

// seed: aceptado desde ya en el cliente (torneo/reto); el backend hoy lo
// ignora — soporte real pendiente en dots-backend
export async function getGameWordsService(seed?: number): Promise<GameWord[]> {
  const { data } = await api.get<GameWord[]>("/games/words", {
    params: seed !== undefined ? { seed } : undefined,
  });
  return data;
}

// seed: reenviado por convención; el backend hoy lo ignora en este endpoint
export async function getDontPopService(seed?: number): Promise<GameWord[]> {
  const { data } = await api.get<GameWord[]>("/games/dont-pop", {
    params: seed !== undefined ? { seed } : undefined,
  });
  return data;
}

// seed: reenviado por convención; el backend hoy lo ignora en este endpoint
export async function getDotaxiService(seed?: number): Promise<DotaxiQuestion[]> {
  const { data } = await api.get<DotaxiQuestion[]>("/games/dotaxi", {
    params: seed !== undefined ? { seed } : undefined,
  });
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

// ── Dot Match (parejas contrarreloj) ─────────────────────────────────────────

export type MatchPair = {
  id: number;
  en: string;
  es: string;
};

export async function getMatchPairsService(
  seed?: number,
): Promise<MatchPair[]> {
  const params = seed !== undefined ? { params: { seed } } : {};
  const { data } = await api.get<MatchPair[]>("/games/match", params);
  return data;
}

export async function getTrueFalseService(
  seed?: number,
): Promise<TrueFalseCard[]> {
  const params = seed !== undefined ? { params: { seed } } : {};
  const { data } = await api.get<TrueFalseCard[]>("/games/true-false", params);
  return data;
}

// ── Memoria Relámpago ─────────────────────────────────────────────────────────

export type MemoryPair = {
  /** Shared id — links the word-card to its image-card. */
  id: number;
  /** English word text shown on the word-card. */
  word: string;
  /** Cloudinary (or legacy) image URL shown on the image-card. */
  img: string;
};

export async function getMemoryPairsService(
  seed?: number,
): Promise<MemoryPair[]> {
  const params = seed !== undefined ? { params: { seed } } : {};
  const { data } = await api.get<MemoryPair[]>("/games/memory", params);
  return data;
}

// ── Escucha Rápida (audio blitz) ─────────────────────────────────────────────

export type AudioBlitzItem = {
  id: number;
  /** sentence_extension to build the Cloudinary audio URL */
  ext: string;
  /** narration character key — undefined for default (Doty) voice */
  voiceKey?: string;
  /** full sentence text with "__" blank; used for correction overlay */
  text: string;
  /** correct m_word (clean()ed) */
  correct: string;
  /** correct + 3 distractors, shuffled */
  options: string[];
};

export async function getAudioBlitzService(
  seed?: number,
): Promise<AudioBlitzItem[]> {
  const params = seed !== undefined ? { params: { seed } } : {};
  const { data } = await api.get<AudioBlitzItem[]>("/games/audio-blitz", params);
  return data;
}

// ── Torre de Palabras ─────────────────────────────────────────────────────────

export type TowerRound = {
  /**
   * vocab_items.id de la palabra: es lo que permite reportarla desde el
   * resultado (spec reportes §5). Un backend viejo no lo manda.
   */
  id?: number;
  /** English word falling from the top. */
  word: string;
  /** Title of the pack this word belongs to (correct answer). */
  correct: string;
  /** 3 pack titles (correct + 2 decoys) — already shuffled by server. */
  options: string[];
};

export async function getWordTowerService(
  seed?: number,
): Promise<TowerRound[]> {
  const params = seed !== undefined ? { params: { seed } } : {};
  const { data } = await api.get<{ rounds: TowerRound[] }>(
    "/games/word-tower",
    params,
  );
  return data.rounds;
}

// ── Constructor (sentence-builder) ────────────────────────────────────────────

export type BuilderSentence = {
  id: number;
  /** sentence_extension to build the Cloudinary audio URL */
  ext: string;
  /** narration character key — undefined for default (Doty) voice */
  voiceKey?: string;
  /** ordered answer tokens */
  answer: string[];
  /**
   * Todos los órdenes válidos, el de referencia (`answer`) incluido (spec
   * reportes §4). Un backend viejo no lo manda: entonces vale solo `answer`.
   */
  answers?: string[][];
  /** answer + 2 distractors, shuffled — the chip pool */
  chips: string[];
};

export async function getSentenceBuilderService(
  seed?: number,
): Promise<BuilderSentence[]> {
  const params = seed !== undefined ? { params: { seed } } : {};
  const { data } = await api.get<{ sentences: BuilderSentence[] }>(
    "/games/sentence-builder",
    params,
  );
  return data.sentences;
}

// ── Palabra del Día (wordle diario) ──────────────────────────────────────────

export type Mark = "hit" | "present" | "miss";

export type WordleGuess = {
  word: string;
  marks: Mark[];
};

export type WordleState = {
  day: string;
  length: number;
  maxTries: number;
  guesses: WordleGuess[];
  done: boolean;
  won: boolean;
  /** Spanish meaning hint — revealed after 3rd guess or when done. */
  hintEs: string | null;
  /** The answer word — only non-null when done. */
  answer: string | null;
  /**
   * vocab_items.id de la respuesta — solo no nulo con `done`, igual que
   * `answer`. Un backend viejo no lo manda.
   */
  answerId?: number | null;
};

export async function getWordleService(): Promise<WordleState> {
  const { data } = await api.get<WordleState>("/games/wordle");
  return data;
}

export async function postWordleGuessService(
  guess: string,
): Promise<WordleState> {
  const { data } = await api.post<WordleState>("/games/wordle/guess", {
    guess,
  });
  return data;
}

// ── Mini Crucigrama (crossword diario) ───────────────────────────────────────

export type CrosswordSlot = {
  id: number;
  dir: "A" | "D";
  row: number;
  col: number;
  len: number;
  clueEs: string;
};

export type CrosswordAnswer = {
  id: number;
  answer: string;
  /**
   * vocab_items.id de la palabra — viaja solo con `done`, como `answers`. Un
   * backend viejo no lo manda.
   */
  vocabId?: number | null;
};

export type CrosswordState = {
  day: string;
  size: 5;
  slots: CrosswordSlot[];
  /** 5×5 grid: user letters or null (includes black cells). */
  cells: (string | null)[][];
  checksUsed: number;
  maxChecks: 5;
  done: boolean;
  won: boolean;
  /** Non-null only when done. */
  answers: CrosswordAnswer[] | null;
};

export type CrosswordCheckResponse = CrosswordState & {
  /** 5×5: true where user letter matches solution; false elsewhere. */
  correct: boolean[][];
};

export async function getCrosswordService(): Promise<CrosswordState> {
  const { data } = await api.get<CrosswordState>("/games/crossword");
  return data;
}

export async function postCrosswordCheckService(
  cells: (string | null)[][],
): Promise<CrosswordCheckResponse> {
  const { data } = await api.post<CrosswordCheckResponse>(
    "/games/crossword/check",
    { cells: cells.map((row) => row.map((c) => c ?? "")) },
  );
  return data;
}
