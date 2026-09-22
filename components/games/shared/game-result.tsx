"use client";

import React, { useEffect, useRef, useState } from "react";
import Doty, { type DotyPose } from "@/components/ui/doty/doty";
import UIButton from "@/components/ui/button/button";
import { UiIcon } from "@/components/ui/ui-icon";
import { useCountUp } from "@/hooks/use-count-up";
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
  /**
   * Pose de Doty cuando la partida NO se ganó (el taxi se rompió, te bajaste
   * a medio camino…). Sin ella, celebra: es lo que quieren los juegos de
   * puntuación abierta, donde acabar ya es el logro. Manda sobre el récord:
   * batir tu marca sin llegar a la meta no es motivo de trofeo.
   */
  dotyPose?: DotyPose;
}

/**
 * Pantalla de fin de partida: llama submitGameScoreService una sola vez al
 * montar (guarda contra el doble efecto de StrictMode con un ref), muestra
 * +XP, nuevo récord y (cuando el backend lo incluya) trono robado.
 *
 * Ni alto propio (`flex-1`, no `min-h-svh`) ni aire vertical propio, por lo
 * mismo que GameIntro: va dentro del caparazón de la página del juego, que ya
 * ocupa la pantalla entera y ya pone su padding con el inset incluido.
 */
export default function GameResult({
  gameKey,
  score,
  onReplay,
  onExit,
  extra,
  dotyPose,
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

  // Throne fields are now typed on ScoreResult
  const tookThrone = result?.tookThrone ?? false;
  const dethronedName = result?.dethronedName ?? null;

  // El marcador sube contando en vez de aparecer seco (respeta reduced-motion)
  const shownScore = useCountUp(score);

  const isNewRecord = result?.isNewHighScore ?? false;

  // Partida por debajo del mínimo: se dice cuánto falta en vez de callar. Sin
  // el chip, no ganar XP se lee como un fallo de la app, no como una regla.
  const xpMinScore = result?.xpMinScore ?? 0;
  const belowXpFloor =
    result !== null && result.xpGained === 0 && xpMinScore > 0 && score < xpMinScore;
  // Sin llegar a la meta mínima —el umbral de XP del juego— no hay fiesta:
  // Doty sale decepcionado y el chip de abajo dice cuánto faltaba. Hasta que
  // el servidor contesta no se sabe, así que mientras tanto una cara neutra
  // en vez de una celebración que luego habría que retirar.
  const pose: DotyPose =
    dotyPose ??
    (result === null
      ? "feliz"
      : belowXpFloor
        ? "decepcionado"
        : isNewRecord
          ? "trofeo-celebracion"
          : "muy-feliz");
  const cheers = dotyPose === undefined && result !== null && !belowXpFloor && isNewRecord;

  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center px-4">
      {/* Fondo decorativo */}
      <div
        aria-hidden
        className="pointer-events-none fixed -bottom-32 -right-24 h-80 w-80 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--accent)" }}
      />

      <div
        className="dots-card dots-compact-card flex w-full max-w-sm flex-col items-center gap-6 px-8 py-10 text-center"
        style={{ animation: "dots-pop-in 0.4s ease-out both" }}
      >
        {/* Doty celebrando o contenta */}
        <div style={{ animation: "dots-float 3s ease-in-out infinite" }}>
          <Doty
            pose={pose}
            size="small"
            animation={cheers ? "cheer" : "bob"}
          />
        </div>

        {/* Puntuación */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-black uppercase tracking-widest text-(--muted)">
            Puntuación
          </span>
          <span
            className="font-display text-5xl font-extrabold tabular-nums inline-block"
            style={{
              background: "linear-gradient(135deg, var(--accent), #fbbf24)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              // pop al llegar al total: remonta por key cuando la cuenta acaba
              animation:
                shownScore === score && score > 0
                  ? "dots-score-pop 0.3s var(--ease-out-strong)"
                  : "none",
            }}
          >
            {shownScore}
          </span>
        </div>

        {/* Chips de recompensa */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {belowXpFloor && (
            <span
              className="rounded-full px-4 py-1.5 text-sm font-black"
              style={{
                background: "color-mix(in srgb, var(--muted) 14%, transparent)",
                border: "2px solid color-mix(in srgb, var(--muted) 35%, transparent)",
                color: "var(--muted)",
                animation: "dots-pop-in 0.4s ease-out 0.1s both",
              }}
            >
              Llega a {xpMinScore} puntos para ganar XP
            </span>
          )}
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
              <UiIcon name="trofeo" size={16} className="inline-block align-middle" /> ¡Nuevo récord!
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
              <UiIcon name="corona" size={16} className="inline-block align-middle" /> ¡Trono robado a {dethronedName}!
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
