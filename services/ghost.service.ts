import api from "@/lib/api-client";

// ── Types ─────────────────────────────────────────────────────────────────────

export type GhostInfo = {
  name: string;
  /** ms timestamps of each correct step (relative to race start). */
  timeline: number[];
  score: number;
  durationMs: number;
};

export type GhostRaceData = {
  seed: number;
  ghost: GhostInfo | null;
};

export type PostGhostRunPayload = {
  seed: number;
  score: number;
  durationMs: number;
  timeline: number[];
};

export type PostGhostRunResult = {
  recorded: boolean;
  beatGhost: boolean;
};

// ── Service functions ─────────────────────────────────────────────────────────

/**
 * GET /ghost/race
 * Returns seed + best rival ghost (or null → client synthesises Doty ghost).
 * Resilient: returns null ghost on network failure so gameplay can still proceed.
 */
export async function getGhostRaceService(): Promise<GhostRaceData> {
  try {
    const { data } = await api.get<GhostRaceData>("/ghost/race");
    return data;
  } catch {
    // Fallback: fresh random seed, no ghost (Doty synthetic will be used)
    return {
      seed: Math.floor(Math.random() * 2_147_483_647),
      ghost: null,
    };
  }
}

/**
 * POST /ghost/run
 * Records the completed run. Server-side: inserts game_run + submits score.
 */
export async function postGhostRunService(
  payload: PostGhostRunPayload,
): Promise<PostGhostRunResult> {
  const { data } = await api.post<PostGhostRunResult>("/ghost/run", payload);
  return data;
}
