"use client";

import React from "react";
import Doty from "../../ui/doty/doty";
import LevelSection from "./level-section/level-section";

type SectionLevelItem = {
  id: number;
  name: string;
  on_construction: number;
  src: string;
  available: boolean;
  levels_left: number;
  progress: number;
};

type Section = { id: number; name: string; levels?: SectionLevelItem[] };

interface DifficultyProps {
  idLevel: number;
  pose: string;
  enabled: number;
  name: string;
  sections?: Section[];
}

const motivational = (pct: number): { msg: string; emoji: string } => {
  if (pct === 0)  return { msg: "Let's go! Start here 👇",      emoji: "🚀" };
  if (pct < 20)   return { msg: "Great start, keep it up!",      emoji: "✨" };
  if (pct < 40)   return { msg: "You're on a roll!",             emoji: "🔥" };
  if (pct < 60)   return { msg: "Halfway there, don't stop!",    emoji: "💪" };
  if (pct < 80)   return { msg: "Almost done, finish strong!",   emoji: "⚡" };
  if (pct < 100)  return { msg: "So close to mastery!",          emoji: "🏅" };
  return           { msg: "Level mastered! You're amazing!",     emoji: "🏆" };
};

export default function Difficulty({ idLevel, pose, enabled, name, sections }: DifficultyProps) {
  const list = sections ?? [];

  const baseColors = [
    "pink", "orangered", "blue", "pale_blue", "opal",
    "orange", "pale_green", "yellow", "green",
  ];
  const shift = (idLevel ?? 0) % baseColors.length;
  const colors = [...baseColors.slice(shift), ...baseColors.slice(0, shift)];

  const prettyName = String(name || "")
    .split(" ")
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");

  // Aggregate progress across all levels in all sections
  const allLevels = list.flatMap((s) => s.levels ?? []);
  const totalProgress =
    allLevels.length > 0
      ? Math.round(allLevels.reduce((sum, l) => sum + (l.progress ?? 0), 0) / allLevels.length)
      : 0;

  // Combo placeholder — will come from backend
  const combo = 0;

  const accent = colors[0] ?? "pink";
  const colorHexMap: Record<string, string> = {
    pink:       "#F472B6",
    orangered:  "#F97316",
    blue:       "#1D4ED8",
    pale_blue:  "#7DD3FC",
    opal:       "#5EEAD4",
    orange:     "#FBBF24",
    pale_green: "#BEF264",
    yellow:     "#FACC15",
    green:      "#34D399",
  };
  const accentHex  = colorHexMap[accent] ?? colorHexMap.pink;
  const accentRgb  = accentHex.replace("#", "");
  const r = parseInt(accentRgb.slice(0, 2), 16);
  const g = parseInt(accentRgb.slice(2, 4), 16);
  const b = parseInt(accentRgb.slice(4, 6), 16);

  const { msg, emoji } = motivational(totalProgress);

  return (
    <div className="flex w-full flex-col gap-4" aria-labelledby={`difficulty-${name}`}>

      {/* ── Banner ─────────────────────────────────────────── */}
      <div
        className="rounded-3xl overflow-hidden"
        style={{
          background: "var(--surface)",
          border: `2px solid rgba(${r},${g},${b},0.35)`,
          boxShadow: `0 4px 20px rgba(${r},${g},${b},0.12)`,
        }}
      >
        <div className="flex items-start gap-4 p-4 pb-3">

          {/* Avatar */}
          <div
            className="shrink-0 w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center"
            style={{
              background: `rgba(${r},${g},${b},0.12)`,
              border: `2px solid rgba(${r},${g},${b},0.25)`,
            }}
          >
            <Doty size="mini" pose={pose} />
          </div>

          {/* Right side */}
          <div className="flex-1 flex flex-col gap-2 min-w-0">

            {/* Title + combo */}
            <div className="flex items-center justify-between gap-2">
              <h3
                id={`difficulty-${name}`}
                className="text-xl md:text-2xl font-extrabold leading-tight truncate text-foreground"
              >
                {prettyName}
              </h3>

              {/* Combo badge */}
              <div
                className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold tracking-wide"
                style={
                  combo > 0
                    ? {
                        background: "rgba(251,191,36,0.15)",
                        border: "1.5px solid rgba(251,191,36,0.45)",
                        color: "#92400e",
                      }
                    : {
                        background: `rgba(${r},${g},${b},0.10)`,
                        border: `1.5px solid rgba(${r},${g},${b},0.25)`,
                        color: accentHex,
                      }
                }
              >
                🔥 {combo}x
              </div>
            </div>

            {/* Motivational label */}
            <p className="text-xs font-bold text-(--muted) leading-none">
              {emoji} {msg}
            </p>

            {/* Progress bar */}
            <div className="flex items-center gap-2 mt-0.5">
              {/* Track */}
              <div
                className="relative flex-1 h-2.5 rounded-full overflow-hidden"
                style={{ background: `rgba(${r},${g},${b},0.12)` }}
              >
                {/* Fill */}
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${totalProgress}%`,
                    background: accentHex,
                  }}
                />
                {/* Shimmer */}
                {totalProgress > 0 && (
                  <div
                    className="absolute inset-y-0 left-0 rounded-full pointer-events-none"
                    style={{
                      width: `${totalProgress}%`,
                      background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%)",
                      backgroundSize: "200% 100%",
                      animation: "shimmer 2s linear infinite",
                    }}
                  />
                )}
              </div>

              {/* Percentage */}
              <span
                className="shrink-0 text-xs font-extrabold tabular-nums leading-none"
                style={{ color: accentHex }}
              >
                {totalProgress}%
              </span>
            </div>

            {Number(enabled) === 0 && (
              <p className="text-xs text-(--muted) mt-0.5">Coming soon…</p>
            )}
          </div>
        </div>

        {/* Footer: levels completed */}
        {allLevels.length > 0 && (
          <div
            className="px-4 py-1.5 flex items-center gap-1.5"
            style={{ borderTop: `1.5px solid rgba(${r},${g},${b},0.15)` }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: accentHex }} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-(--muted)">
              {allLevels.filter((l) => (l.progress ?? 0) >= 100).length} / {allLevels.length} levels completed
            </span>
          </div>
        )}
      </div>

      {/* ── Sections ───────────────────────────────────────── */}
      <div className="space-y-4">
        {list.length === 0 ? (
          <span className="text-(--muted)">No sections available.</span>
        ) : (
          list.map((section) => (
            <LevelSection
              key={section.id}
              id={section.id}
              name={section.name}
              levels={section.levels ?? []}
              colors={colors}
            />
          ))
        )}
      </div>
    </div>
  );
}
