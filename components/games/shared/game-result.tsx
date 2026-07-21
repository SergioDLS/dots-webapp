"use client";

import React, { useEffect, useRef, useState } from "react";
import Doty from "@/components/ui/doty/doty";
import UIButton from "@/components/ui/button/button";
import {
  submitGameScoreService,
  type ScoreResult,
  type GameKey,
} from "@/services/engagement.service";

interface GameResultProps {
  gameKey: GameKey;
  score: number;
  onReplay: () => void;
  onExit: () => void;
  extra?: React.ReactNode;
}

/**
 * Pantalla de fin de partida: llama submitGameScoreService una sola vez al
 * montar (guarda contra el doble efecto de StrictMode con un ref), muestra
 * +XP, nuevo récord y (cuando el backend lo incluya) trono robado.
 */
export default function GameResult({
  gameKey,
  score,
  onReplay,
  onExit,
  extra,
}: GameResultProps) {
  const [result, setResult] = useState<ScoreResult | null>(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    // Guard: StrictMode monta+desmonta+remonta; el ref asegura un solo envío.
    if (submittedRef.current) return;
    submittedRef.current = true;

    submitGameScoreService(gameKey, score)
      .then(setResult)
      .catch(() => {
        // Silenciar errores: score no crítico para la UI
      });
  }, [gameKey, score]);

  // Determinar si el backend reportó robo de trono (campo futuro, acceso defensivo)
  const tookThrone = (result as (ScoreResult & { tookThrone?: boolean; dethronedName?: string }) | null)?.tookThrone ?? false;
  const dethronedName = (result as (ScoreResult & { tookThrone?: boolean; dethronedName?: string }) | null)?.dethronedName ?? null;

  const isNewRecord = result?.isNewHighScore ?? false;
  const dotyPose = isNewRecord ? "07" : "02";

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center px-4 py-8">
      {/* Fondo decorativo */}
      <div
        aria-hidden
        className="pointer-events-none fixed -bottom-32 -right-24 h-80 w-80 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--accent)" }}
      />

      <div
        className="dots-card flex w-full max-w-sm flex-col items-center gap-6 px-8 py-10 text-center"
        style={{ animation: "dots-pop-in 0.4s ease-out both" }}
      >
        {/* Doty celebrando o contenta */}
        <div style={{ animation: "dots-float 3s ease-in-out infinite" }}>
          <Doty
            pose={dotyPose}
            size="small"
            animation={isNewRecord ? "cheer" : "bob"}
          />
        </div>

        {/* Puntuación */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-black uppercase tracking-widest text-(--muted)">
            Puntuación
          </span>
          <span
            className="font-display text-5xl font-extrabold"
            style={{
              background: "linear-gradient(135deg, var(--accent), #fbbf24)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {score}
          </span>
        </div>

        {/* Chips de recompensa */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {result && result.xpGained > 0 && (
            <span
              className="rounded-full px-4 py-1.5 text-sm font-black"
              style={{
                background: "color-mix(in srgb, var(--gold) 18%, transparent)",
                border: "2px solid color-mix(in srgb, var(--gold) 45%, transparent)",
                color: "var(--gold-edge)",
                animation: "dots-pop-in 0.4s ease-out 0.1s both",
              }}
            >
              ✨ +{result.xpGained} XP
            </span>
          )}
          {isNewRecord && (
            <span
              className="rounded-full px-4 py-1.5 text-sm font-black text-(--accent)"
              style={{
                background: "color-mix(in srgb, var(--accent) 14%, transparent)",
                border: "2px solid color-mix(in srgb, var(--accent) 40%, transparent)",
                animation: "dots-pop-in 0.4s ease-out 0.2s both",
              }}
            >
              🏆 ¡Nuevo récord!
            </span>
          )}
          {tookThrone && dethronedName && (
            <span
              className="rounded-full px-4 py-1.5 text-sm font-black"
              style={{
                background: "color-mix(in srgb, #fbbf24 18%, transparent)",
                border: "2px solid color-mix(in srgb, #fbbf24 45%, transparent)",
                color: "#92400e",
                animation: "dots-pop-in 0.4s ease-out 0.3s both",
              }}
            >
              👑 ¡Trono robado a {dethronedName}!
            </span>
          )}
        </div>

        {/* Slot extra (contenido adicional de cada juego) */}
        {extra}

        {/* Acciones */}
        <div
          className="flex w-full flex-col gap-3"
          style={{ animation: "dots-pop-in 0.4s ease-out 0.4s both" }}
        >
          <UIButton tone="accent" fullWidth onClick={onReplay}>
            Otra vez
          </UIButton>
          <UIButton tone="neutral" fullWidth onClick={onExit}>
            Salir
          </UIButton>
        </div>
      </div>
    </div>
  );
}
