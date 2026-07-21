"use client";
import { useSearchParams } from "next/navigation";
import { useRef, useCallback } from "react";
import { postTournamentScoreService } from "@/services/tournament.service";

export function useTournamentMode() {
  const searchParams = useSearchParams();
  const isTournament = searchParams.get("tournament") === "1";
  const submittedRef = useRef(false);

  const submitTournamentScore = useCallback(
    (score: number) => {
      if (!isTournament || submittedRef.current) return;
      submittedRef.current = true;
      postTournamentScoreService(score).catch(() => {});
    },
    [isTournament],
  );

  return { isTournament, submitTournamentScore };
}
