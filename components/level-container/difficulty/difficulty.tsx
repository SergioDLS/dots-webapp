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

export default function Difficulty({ idLevel, pose, enabled, name, sections }: DifficultyProps) {
  const list = sections ?? [];

  // Parent-level color palette for this difficulty (rotated by idLevel)
  const baseColors = [
    "pink",
    "orangered",
    "blue",
    "pale_blue",
    "opal",
    "orange",
    "pale_green",
    "yellow",
    "green",
  ];
  const shift = (idLevel ?? 0) % baseColors.length;
  const colors = [...baseColors.slice(shift), ...baseColors.slice(0, shift)];

  const prettyName = String(name || "")
    .split(" ")
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");

  const accent = colors && colors.length > 0 ? colors[0] : "pink";
  const colorHexMap: Record<string, string> = {
    pink: "#F472B6",
    orangered: "#F97316",
    blue: "#1D4ED8",
    pale_blue: "#7DD3FC",
    opal: "#5EEAD4",
    orange: "#FBBF24",
    pale_green: "#BEF264",
    yellow: "#FACC15",
    green: "#34D399",
  };
  const accentHex = colorHexMap[accent] ?? colorHexMap.pink;

  return (
    <div className="flex w-full flex-col gap-4" aria-labelledby={`difficulty-${name}`}>
      <div
        className="group rounded-2xl p-3 flex items-center gap-3 hover:-translate-y-1 transition-transform"
        style={{
          background: "rgba(255,255,255,0.04)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 6px 18px rgba(10,10,20,0.06)",
        }}
      >
        <div className="relative -ml-1">
          <div className="w-14 h-14 rounded-xl overflow-hidden bg-white/5 flex items-center justify-center shadow-md transform-gpu transition-transform duration-300 group-hover:scale-105">
            <Doty size="mini" pose={pose} />
          </div>
          <div className="absolute -right-2 -bottom-1 w-5 h-5 rounded-full bg-white/6 blur-sm opacity-40" />
        </div>

          <div className="flex-1">
          <h3
            id={`difficulty-${name}`}
            className="text-xl md:text-2xl font-extrabold leading-tight bg-clip-text text-transparent"
            style={{ backgroundImage: `linear-gradient(90deg, ${accentHex}, ${accentHex}88)` }}
          >
            {prettyName}
          </h3>
          {Number(enabled) === 0 ? (
            <div className="text-xs text-(--muted)">Coming soon...</div>
          ) : null}
        </div>
        {/* minimal header: no internal level counter to keep things compact */}
      </div>

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
