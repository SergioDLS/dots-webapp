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

  return (
    <div
      className="flex w-full flex-col gap-4"
      aria-labelledby={`difficulty-${name}`}
    >
      <div
        className="rounded-2xl p-4"
        style={{
          background: "linear-gradient(155deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.10) 100%)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          border: "1px solid rgba(255,255,255,0.10)",
          boxShadow: "0 8px 30px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="shrink-0">
            <Doty size="mini" pose={pose} />
          </div>
          <div>
            <h3 id={`difficulty-${name}`} className="text-2xl font-extrabold capitalize text-foreground leading-tight">
              {name}
            </h3>
            {Number(enabled) === 0 ? (
              <div className="text-xs text-(--muted)">Coming soon...</div>
            ) : null}
          </div>
        </div>
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
