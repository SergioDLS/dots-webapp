"use client";

import React from "react";
import Image from "next/image";
import UIButton from "@/components/ui/button/button";
import { UiIcon } from "@/components/ui/ui-icon";
import { gameArt } from "@/lib/arcade";
import type { GameKey } from "@/services/engagement.service";

interface ThroneInfo {
  name: string;
  score: number;
}

/** Tamaño del arte: el mismo 82 px del tile del arcade, para que la pieza no
 *  cambie de tamaño entre la grilla y esta pantalla. */
const ART = 82;

interface GameIntroProps {
  /** Clave del juego: de ella sale el MISMO arte que enseña la grilla. */
  gameKey: GameKey;
  title: string;
  howTo: string[];
  record: number | null;
  throne: ThroneInfo | null;
  onStart: () => void;
}

/**
 * Pantalla de inicio de juego: muestra reglas, récord personal y trono.
 * También actúa como gesto de usuario para desbloquear el autoplay de audio.
 *
 * Esto se pinta DENTRO del caparazón de la página del juego, y de ahí las dos
 * cosas que esta pantalla NO hace:
 *
 * - No mide una pantalla propia (`flex-1`, no `min-h-svh`). El caparazón ya es
 *   `min-h-svh` y encima añade su padding y la fila de "Salir", así que con un
 *   alto propio la suma daba 100svh + 68 px y toda intro —y todo resultado—
 *   arrancaba con un scroll que no llevaba a ninguna parte. Creciendo hasta
 *   llenar el hueco que le deja el caparazón, la tarjeta sigue centrada y la
 *   pantalla no scrollea. Si el contenido no cupiera —pantalla muy baja con
 *   récord y trono—, `min-height: auto` del ítem flex deja que crezca y la
 *   página scrollea lo justo.
 *
 * - No pone aire vertical propio. El caparazón ya lo pone, y el suyo incluye
 *   el inset del home indicator; duplicarlo eran 24 px de más en vertical que
 *   bastaban para que las intros más largas scrollearan sin necesidad.
 */
export default function GameIntro({
  gameKey,
  title,
  howTo,
  record,
  throne,
  onStart,
}: GameIntroProps) {
  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center px-4">
      {/* Fondo decorativo */}
      <div
        aria-hidden
        className="pointer-events-none fixed -bottom-32 -left-24 h-80 w-80 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--accent)" }}
      />

      <div
        className="dots-card dots-compact-card flex w-full max-w-sm flex-col items-center gap-6 px-8 py-10 text-center"
        style={{ animation: "dots-pop-in 0.4s ease-out both" }}
      >
        {/* El arte del propio juego, no Doty: es el icono con el que el
            jugador lo eligió en la grilla y así la pantalla lo confirma. */}
        <div style={{ animation: "dots-float 3s ease-in-out infinite" }}>
          <Image
            src={gameArt(gameKey)}
            alt=""
            aria-hidden
            width={512}
            height={512}
            sizes={`${ART}px`}
            priority
            className="dots-floor-shadow h-auto select-none object-contain"
            style={{ width: ART }}
            draggable={false}
          />
        </div>

        {/* Título del juego */}
        <div className="flex flex-col items-center gap-1">
          <h1 className="font-display text-2xl font-extrabold text-foreground">
            {title}
          </h1>
        </div>

        {/* Cómo se juega */}
        <div className="dots-compact-list w-full rounded-2xl px-5 py-4 text-left"
          style={{ background: "var(--surface)", border: "2px solid var(--border)" }}
        >
          <p className="mb-2 text-xs font-black uppercase tracking-widest text-(--muted)">
            Cómo se juega
          </p>
          <ol className="flex flex-col gap-1.5">
            {howTo.map((step, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm font-semibold text-foreground"
              >
                <span
                  className="mt-0.5 shrink-0 rounded-full text-xs font-black w-5 h-5 flex items-center justify-center"
                  style={{
                    background: "color-mix(in srgb, var(--accent) 18%, transparent)",
                    color: "var(--accent)",
                  }}
                >
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        {/* Récord personal */}
        {record !== null && (
          <p
            className="text-sm font-bold"
            style={{ color: "var(--muted)", animation: "dots-pop-in 0.4s ease-out 0.1s both" }}
          >
            <UiIcon name="medalla" size={16} className="inline-block align-middle" /> Tu récord:{" "}
            <span className="font-black text-foreground">{record}</span>
          </p>
        )}

        {/* Trono social */}
        {throne !== null && (
          <p
            className="text-sm font-bold"
            style={{ color: "var(--muted)", animation: "dots-pop-in 0.4s ease-out 0.2s both" }}
          >
            <UiIcon name="trofeo" size={16} className="inline-block align-middle" />{" "}
            <span className="font-black text-foreground">{throne.name}</span>{" "}
            reina con{" "}
            <span className="font-black text-foreground">{throne.score}</span>{" "}
            — ¡destrónalo!
          </p>
        )}

        {/* CTA principal — también actúa de gesto para desbloquear audio */}
        <UIButton tone="accent" fullWidth onClick={onStart}>
          ¡Empezar!
        </UIButton>
      </div>
    </div>
  );
}
