"use client";

import React from "react";
import Doty from "@/components/ui/doty/doty";
import UIButton from "@/components/ui/button/button";

interface ThroneInfo {
  name: string;
  score: number;
}

interface GameIntroProps {
  emoji: string;
  title: string;
  howTo: string[];
  record: number | null;
  throne: ThroneInfo | null;
  onStart: () => void;
}

/**
 * Pantalla de inicio de juego: muestra reglas, récord personal y trono.
 * También actúa como gesto de usuario para desbloquear el autoplay de audio.
 */
export default function GameIntro({
  emoji,
  title,
  howTo,
  record,
  throne,
  onStart,
}: GameIntroProps) {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center px-4 py-8">
      {/* Fondo decorativo */}
      <div
        aria-hidden
        className="pointer-events-none fixed -bottom-32 -left-24 h-80 w-80 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--accent)" }}
      />

      <div
        className="dots-card flex w-full max-w-sm flex-col items-center gap-6 px-8 py-10 text-center"
        style={{ animation: "dots-pop-in 0.4s ease-out both" }}
      >
        {/* Doty con pose de bienvenida */}
        <div style={{ animation: "dots-float 3s ease-in-out infinite" }}>
          <Doty pose="12" size="small" />
        </div>

        {/* Título del juego */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-4xl" role="img" aria-label={title}>
            {emoji}
          </span>
          <h1 className="font-display text-2xl font-extrabold text-foreground">
            {title}
          </h1>
        </div>

        {/* Cómo se juega */}
        <div className="w-full rounded-2xl px-5 py-4 text-left"
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
            🏅 Tu récord:{" "}
            <span className="font-black text-foreground">{record}</span>
          </p>
        )}

        {/* Trono social */}
        {throne !== null && (
          <p
            className="text-sm font-bold"
            style={{ color: "var(--muted)", animation: "dots-pop-in 0.4s ease-out 0.2s both" }}
          >
            🏆{" "}
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
