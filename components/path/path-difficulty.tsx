"use client";

import React from "react";
import Doty from "@/components/ui/doty/doty";
import PathSection from "./path-section";
import type { PathDifficulty as PathDifficultyType } from "@/types/path.types";
import {
  DIFFICULTY_COLOR_NAMES,
  DIFFICULTY_COLOR_HEX,
} from "@/lib/difficulty-palette";

interface PathDifficultyProps {
  difficulty: PathDifficultyType;
}

const motivational = (pct: number): { msg: string; emoji: string } => {
  if (pct === 0)  return { msg: "¡Vamos! Empieza aquí 👇",           emoji: "🚀" };
  if (pct < 20)   return { msg: "¡Buen comienzo, sigue así!",        emoji: "✨" };
  if (pct < 40)   return { msg: "¡Vas con todo!",                    emoji: "🔥" };
  if (pct < 60)   return { msg: "¡Mitad del camino, no pares!",      emoji: "💪" };
  if (pct < 80)   return { msg: "¡Ya casi, termina con fuerza!",     emoji: "⚡" };
  if (pct < 100)  return { msg: "¡A un paso de dominarlo!",          emoji: "🏅" };
  return           { msg: "¡Nivel dominado! ¡Increíble!",            emoji: "🏆" };
};

export default function PathDifficulty({ difficulty }: PathDifficultyProps) {
  const { id, name, img, progress, skipped, sections } = difficulty;

  // Same palette rotation as the legacy dashboard: shift by difficulty id
  const baseColors = [...DIFFICULTY_COLOR_NAMES];
  const shift = (id ?? 0) % baseColors.length;
  const colors = [...baseColors.slice(shift), ...baseColors.slice(0, shift)];

  const accentHex = DIFFICULTY_COLOR_HEX[colors[0]] ?? DIFFICULTY_COLOR_HEX.pink;

  const prettyName = String(name || "")
    .split(" ")
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");

  const allNodes = sections.flatMap((s) =>
    s.nodes.filter((n) => n.type !== "checkpoint"),
  );
  const doneCount = allNodes.filter((n) => n.completed).length;

  const pct = Math.max(0, Math.min(100, Math.round(progress ?? 0)));
  const { msg, emoji } = motivational(pct);

  // Una dificultad está desbloqueada si alguna sección lo está (o fue superada
  // por test). Un usuario nuevo solo tiene Beginner abierta; el resto se
  // muestran como bloques bloqueados hasta llegar a ellas por el camino.
  const unlocked =
    skipped || sections.some((s) => s.unlocked || s.skipped);

  if (!unlocked) {
    return (
      <div
        className="flex w-full items-center gap-4 rounded-3xl p-5 opacity-90"
        style={{ background: "var(--surface)", border: "2px dashed var(--border)" }}
        aria-labelledby={`path-difficulty-${id}`}
      >
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
          style={{ background: "var(--surface-2)", border: "2px solid var(--border)" }}
        >
          <span className="text-2xl">🔒</span>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3
            id={`path-difficulty-${id}`}
            className="truncate font-display text-lg font-extrabold text-(--muted)"
          >
            {prettyName}
          </h3>
          <p className="text-xs font-bold text-(--muted)">
            Completa el nivel anterior para desbloquear
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4" aria-labelledby={`path-difficulty-${id}`}>

      {/* ── Banner (evolved from difficulty.tsx) ───────────── */}
      <div
        className="relative rounded-3xl overflow-hidden"
        style={{
          background: "var(--surface)",
          border: `2px solid ${accentHex}66`,
          boxShadow: `0 4px 0 ${accentHex}44, 0 12px 30px -14px rgba(33,22,80,0.2)`,
        }}
      >
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{ background: `${accentHex}14` }}
        />
        <div className="relative flex items-start gap-4 p-5 pb-4">

          {/* Avatar */}
          <div
            className="shrink-0 w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center"
            style={{
              background: `${accentHex}22`,
              border: `2px solid ${accentHex}44`,
              animation: "dots-float 4s ease-in-out infinite",
            }}
          >
            <Doty size="mini" pose={img || "01"} />
          </div>

          {/* Right side */}
          <div className="flex-1 flex flex-col gap-2.5 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3
                id={`path-difficulty-${id}`}
                className="font-display text-xl md:text-2xl font-extrabold leading-tight truncate text-foreground"
              >
                {prettyName}
              </h3>

              {skipped && (
                <div
                  className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold tracking-wide"
                  style={{
                    background: "color-mix(in srgb, var(--gold) 18%, var(--surface))",
                    border: "2px solid var(--gold)",
                    color: "var(--gold-edge)",
                  }}
                >
                  ⏭️ Superado
                </div>
              )}
            </div>

            <p className="text-xs font-bold text-(--muted) leading-none">
              {emoji} {msg}
            </p>

            {/* Progress bar */}
            <div className="flex items-center gap-2">
              <div
                className="relative flex-1 rounded-full overflow-hidden"
                style={{ height: 8, background: `${accentHex}22` }}
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${pct}%`, background: accentHex }}
                />
              </div>
              <span
                className="shrink-0 text-xs font-extrabold tabular-nums leading-none"
                style={{ color: accentHex }}
              >
                {pct}%
              </span>
            </div>
          </div>
        </div>

        {/* Footer: completed nodes */}
        {allNodes.length > 0 && (
          <div
            className="relative px-5 py-2 flex items-center gap-2"
            style={{ borderTop: `2px solid ${accentHex}33` }}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: accentHex }} />
            <span className="text-[10px] font-black uppercase tracking-widest text-(--muted)">
              {doneCount} / {allNodes.length} lecciones completadas
            </span>
          </div>
        )}
      </div>

      {/* ── Sections: the path itself ──────────────────────── */}
      <div className="space-y-6">
        {sections.length === 0 ? (
          <span className="text-(--muted)">No hay secciones disponibles.</span>
        ) : (
          sections.map((section, i) => {
            const colorName = colors[i % colors.length];
            return (
              <PathSection
                key={section.id}
                section={section}
                accentHex={DIFFICULTY_COLOR_HEX[colorName] ?? accentHex}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
