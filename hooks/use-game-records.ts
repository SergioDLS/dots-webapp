"use client";

import { useEffect, useState } from "react";
import {
  getGameRecordsService,
  type GameRecord,
} from "@/services/games.service";
import { getGameScoresService, type GameScore } from "@/services/engagement.service";
import { readCurrentUserId } from "@/lib/current-user";

export interface ThroneInfo {
  name: string;
  score: number;
}

export interface GameRecordsResult {
  /** The current user's personal high score for this game, or null if none. */
  record: number | null;
  /**
   * Global throne holder info — null if the current user IS the holder
   * (we show "El trono es TUYO" in that case, handled by the caller via
   * GameIntro's throne=null + record showing the score).
   * Null also when no record exists yet for this game.
   */
  throne: ThroneInfo | null;
}

/**
 * Fetches global records and the current user's own scores in parallel.
 * Returns `{record, throne}` for the given gameKey.
 *
 * - throne is null if the holder IS the current user (GameIntro shows their own record instead).
 * - Resilient: returns {record: null, throne: null} on any error so the game stays playable.
 */
export function useGameRecords(gameKey: string): GameRecordsResult {
  const [record, setRecord] = useState<number | null>(null);
  const [throne, setThrone] = useState<ThroneInfo | null>(null);

  useEffect(() => {
    let active = true;

    const currentUserId: number | null = readCurrentUserId();

    Promise.all([getGameRecordsService(), getGameScoresService()]).then(
      ([records, scores]: [GameRecord[], GameScore[]]) => {
        if (!active) return;

        // Own score for this game
        const ownScore = scores.find((s) => s.gameKey === gameKey);
        setRecord(ownScore ? ownScore.highScore : null);

        // Global throne for this game
        const globalRecord = records.find((r) => r.gameKey === gameKey);
        if (!globalRecord) {
          setThrone(null);
          return;
        }

        // If the current user already holds the throne, don't show it as a challenge
        if (currentUserId !== null && globalRecord.holderId === currentUserId) {
          setThrone(null);
        } else {
          setThrone({
            name: globalRecord.holderName,
            score: globalRecord.highScore,
          });
        }
      },
    ).catch(() => {
      // Endpoint failure — leave record/throne as null; game stays playable
    });

    return () => {
      active = false;
    };
  }, [gameKey]);

  return { record, throne };
}
