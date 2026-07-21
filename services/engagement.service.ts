import api from "@/lib/api-client";

// ── Types (frozen backend contracts) ─────────────────────────────────────────
export type GameKey =
  | "dot-bombs"
  | "dont-pop"
  | "flashcards"
  | "dotaxi"
  | "speed-round"
  | "dot-match"
  | "true-false"
  | "memory"
  | "audio-blitz"
  | "word-tower"
  | "sentence-builder"
  | "wordle"
  | "crossword"
  | "ghost-race";

/** Enriched response of PUT /sentences/progress */
export type ProgressReward = {
  message: string;
  xpGained: number;
  xp: number;
  streak: number;
  streakUp: boolean;
  /** a banked streak freeze was spent to cover a missed day */
  freezeUsed?: boolean;
  /** this session earned a new streak freeze */
  freezeEarned?: boolean;
};

export type SentenceProgress = {
  id_sentence: number;
  answered?: boolean;
  times_wrong: number;
};

/** Response of POST /games/score */
export type ScoreResult = {
  highScore: number;
  isNewHighScore: boolean;
  xpGained: number;
  xp: number;
};

export type GameScore = {
  gameKey: GameKey;
  highScore: number;
};

export type ReadingSummary = {
  id: number;
  title: string;
  src: string | null;
  unlock: number;
  unlocked: boolean;
  completed: boolean;
};

export type ReadingQuizQuestion = {
  idx: number;
  prompt: string;
  options: string[];
};

export type ReadingDetail = {
  id: number;
  title: string;
  text: string;
  src: string | null;
  quiz: ReadingQuizQuestion[];
};

/** Response of POST /readings/:id/complete (pass = ≥85% correct) */
export type ReadingResult = {
  passed: boolean;
  correct: number;
  total: number;
  xpGained: number;
  xp: number;
};

export type LeaderboardEntry = {
  rank: number;
  name: string;
  last_name: string;
  xp: number;
  streak: number;
};

export type LeaderboardPeriod = "all" | "week";

/** Response of GET /me/quest */
export type DailyQuest = {
  key: string;
  title: string;
  goal: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
  reward: number;
};

/** Response of POST /me/quest/claim */
export type QuestClaimResult = {
  xpGained: number;
  xp: number;
};

export type Badge = {
  key: string;
  title: string;
  emoji: string;
  earned: boolean;
  progress: number;
  goal: number;
};

/** Response of GET /me/stats (level = floor(sqrt(xp/100)) + 1) */
export type MyStats = {
  xp: number;
  streak: number;
  level: number;
  xpForNextLevel: number;
  highScores: GameScore[];
  readingsCompleted: number;
  streakFreezes: number;
  bestStreak: number;
  xpWeek: number;
  /** Gemas (moneda del juego); puede faltar si la economía aún no se migró. */
  gems?: number;
};

// ── Fetchers ──────────────────────────────────────────────────────────────────
export async function putSentencesProgressService(body: {
  sentences: SentenceProgress[];
  level_id: number;
}): Promise<ProgressReward> {
  const { data } = await api.put<ProgressReward>("/sentences/progress", body);
  return data;
}

export async function submitGameScoreService(
  gameKey: GameKey,
  score: number,
): Promise<ScoreResult> {
  const { data } = await api.post<ScoreResult>("/games/score", {
    gameKey,
    score,
  });
  return data;
}

export async function getGameScoresService(): Promise<GameScore[]> {
  try {
    const { data } = await api.get<GameScore[]>("/games/scores");
    return data;
  } catch {
    return [];
  }
}

export async function getReadingsService(): Promise<ReadingSummary[]> {
  try {
    const { data } = await api.get<ReadingSummary[]>("/readings");
    return data;
  } catch {
    return [];
  }
}

export async function getReadingService(
  id: number | string,
): Promise<ReadingDetail> {
  const { data } = await api.get<ReadingDetail>(`/readings/${id}`);
  return data;
}

export async function completeReadingService(
  id: number | string,
  answers: string[],
): Promise<ReadingResult> {
  const { data } = await api.post<ReadingResult>(`/readings/${id}/complete`, {
    answers,
  });
  return data;
}

export async function getLeaderboardService(
  period: LeaderboardPeriod = "all",
): Promise<LeaderboardEntry[]> {
  try {
    const { data } = await api.get<LeaderboardEntry[]>("/leaderboard", {
      params: { period },
    });
    return data;
  } catch {
    return [];
  }
}

export async function getMyQuestService(): Promise<DailyQuest | null> {
  try {
    const { data } = await api.get<DailyQuest>("/me/quest");
    return data;
  } catch {
    return null;
  }
}

/** Throws on failure (e.g. 400 when the quest isn't completed or was claimed). */
export async function claimQuestService(): Promise<QuestClaimResult> {
  const { data } = await api.post<QuestClaimResult>("/me/quest/claim");
  return data;
}

export async function getMyBadgesService(): Promise<Badge[]> {
  try {
    const { data } = await api.get<Badge[]>("/me/badges");
    return data;
  } catch {
    return [];
  }
}

export async function getMyStatsService(): Promise<MyStats | null> {
  try {
    const { data } = await api.get<MyStats>("/me/stats");
    return data;
  } catch {
    return null;
  }
}
