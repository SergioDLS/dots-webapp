"use client";

import React from "react";
import Doty from "../../ui/doty/doty";
import LevelSection from "./level-section/level-section";
import type { SectionLevel } from "@/types/levels.types";

interface DifficultyProps {
  idLevel: number;
  pose: string;
  enabled: number;
  name: string;
  sections?: SectionLevel[];
  progress: number;
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

export default function Difficulty({ idLevel, pose, enabled, name, sections, progress }: DifficultyProps) {
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

  const { msg, emoji } = motivational(progress);

  return (
    <div className="flex w-full flex-col gap-4" aria-labelledby={`difficulty-${name}`}>

      {/* ── Banner ─────────────────────────────────────────── */}
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{
          background: `${accentHex}18`,
          border: `2px solid ${accentHex}55`,
          boxShadow: `0 2px 10px rgba(0,0,0,0.06)`,
        }}
      >
        <div className="relative flex items-start gap-4 p-5 pb-4">

          {/* Avatar */}
          <div
            className="shrink-0 w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center"
            style={{
              background: `${accentHex}22`,
              border: `2px solid ${accentHex}44`,
            }}
          >
            <Doty size="mini" pose={pose} />
          </div>

          {/* Right side */}
          <div className="flex-1 flex flex-col gap-2.5 min-w-0">

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
                        background: "#fef3c7",
                        border: "2px solid #fbbf24",
                        color: "#92400e",
                      }
                    : {
                        background: `${accentHex}18`,
                        border: `2px solid ${accentHex}44`,
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
            <div className="flex items-center gap-2">
              <div
                className="relative flex-1 rounded-full overflow-hidden"
                style={{ height: 8, background: `${accentHex}22` }}
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${progress}%`,
                    background: accentHex,
                  }}
                />
              </div>
              <span
                className="shrink-0 text-xs font-extrabold tabular-nums leading-none"
                style={{ color: accentHex }}
              >
                {progress}%
              </span>
            </div>

            {Number(enabled) === 0 && (
              <p className="text-xs text-(--muted)">Coming soon…</p>
            )}
          </div>
        </div>

        {/* Footer: levels completed */}
        {allLevels.length > 0 && (
          <div
            className="relative px-5 py-2 flex items-center gap-2"
            style={{ borderTop: `2px solid ${accentHex}33` }}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: accentHex }} />
            <span className="text-[10px] font-black uppercase tracking-widest text-(--muted)">
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
              progress={section.progress}
            />
          ))
        )}
      </div>
    </div>
  );
}
