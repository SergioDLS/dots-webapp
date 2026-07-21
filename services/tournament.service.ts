const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface TournamentData {
  week: string;
  gameKey: string;
  gameName: string;
  gamePath: string;
  seed: number;
  endsAt: string;
  top: { name: string; score: number }[];
  me: { rank: number; best: number; plays: number } | null;
}

export async function getTournamentService(): Promise<TournamentData | null> {
  try {
    const res = await fetch(`${API_URL}/tournament`, { credentials: "include" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function postTournamentScoreService(score: number): Promise<void> {
  await fetch(`${API_URL}/tournament/score`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ score }),
  });
}
