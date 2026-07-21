import api from "@/lib/api-client";

export type TournamentTopEntry = { name: string; score: number };
export type TournamentMe = { rank: number; best: number; plays: number };

export interface TournamentData {
  week: string;
  gameKey: string;
  gameName: string;
  gamePath: string;
  seed: number;
  endsAt: string;
  top: TournamentTopEntry[];
  me: TournamentMe | null;
}

/** Estado del torneo semanal; null si no hay sesión o el backend no responde. */
export async function getTournamentService(): Promise<TournamentData | null> {
  try {
    const { data } = await api.get<TournamentData>("/tournament");
    return data;
  } catch {
    return null;
  }
}

/** Sube el score de una partida al torneo de la semana actual. */
export async function postTournamentScoreService(score: number): Promise<void> {
  await api.post("/tournament/score", { score });
}
