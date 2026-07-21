import api from "@/lib/api-client";

// ── Types ─────────────────────────────────────────────────────────────────────

/** Juegos con mazo por semilla que soportan retos 1v1 (espejo del backend). */
export const CHALLENGE_GAMES = [
  { key: "dot-match", name: "Dot Match" },
  { key: "true-false", name: "¿Verdad o Trampa?" },
  { key: "memory", name: "Memoria Relámpago" },
  { key: "audio-blitz", name: "Escucha Rápida" },
  { key: "word-tower", name: "Torre de Palabras" },
  { key: "sentence-builder", name: "Constructor" },
] as const;

export type Challenge = {
  id: number;
  gameKey: string;
  gameName: string;
  gamePath: string;
  seed: number;
  challengerName: string;
  challengedName: string;
  challengerScore: number | null;
  challengedScore: number | null;
  status: string;
  winnerId: number | null;
  /** true = yo soy quien retó */
  mine: boolean;
};

export type ChallengesData = {
  incoming: Challenge[];
  outgoing: Challenge[];
  history: Challenge[];
};

const EMPTY: ChallengesData = { incoming: [], outgoing: [], history: [] };

// ── Fetchers ──────────────────────────────────────────────────────────────────

/** Mis retos 1v1; resiliente — listas vacías si no hay sesión o falla la red. */
export async function getChallengesService(): Promise<ChallengesData> {
  try {
    const { data } = await api.get<ChallengesData>("/challenges");
    return {
      incoming: data?.incoming ?? [],
      outgoing: data?.outgoing ?? [],
      history: data?.history ?? [],
    };
  } catch {
    return EMPTY;
  }
}

/** Crea un reto 1v1 contra otro estudiante. Lanza si el backend rechaza. */
export async function postChallengeService(
  challengedId: number,
  gameKey: string,
): Promise<Challenge> {
  const { data } = await api.post<Challenge>("/challenges", {
    challengedId,
    gameKey,
  });
  return data;
}

/** Registra mi score en un reto (la primera partida cuenta). */
export async function postChallengeScoreService(
  id: number,
  score: number,
): Promise<void> {
  await api.post(`/challenges/${id}/score`, { score });
}
