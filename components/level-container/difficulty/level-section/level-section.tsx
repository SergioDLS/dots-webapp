"use client";

import React from "react";
import LevelWord from "./level-word/level-word";

type LevelItem = {
  id: number;
  name: string;
  on_construction: number;
  src: string;
  available: boolean;
  levels_left: number;
  progress: number;
};

interface LevelSectionProps {
  id: number;
  name: string;
  levels?: LevelItem[];
  colors?: string[];
}

export default function LevelSection({ id, name, levels, colors }: LevelSectionProps) {
  const list = levels ?? [];
  const accent = (colors && colors.length > 0 ? colors[0] : "pink") || "pink";
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

  // Section progress — thin, discreet
  const sectionProgress =
    list.length > 0
      ? Math.round(list.reduce((sum, l) => sum + (l.progress ?? 0), 0) / list.length)
      : 0;

  // Clustered layout: items arranged in rows with slight overlap/offsets
  return (
    <div className="flex w-full flex-col gap-5" data-section-id={id}>

      {/* Section header with subtle progress bar */}
      <div className="w-full flex flex-col items-center gap-1.5">
        <span className="text-2xl font-semibold text-foreground flex items-center gap-3">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ background: accentHex }}
          />
          {name}
        </span>

        {/* Thin progress bar — discreet, doesn't compete with Difficulty's bar */}
        <div className="w-40 flex items-center gap-1.5">
          <div
            className="flex-1 h-1 rounded-full overflow-hidden"
            style={{ background: `rgba(0,0,0,0.08)` }}
          >
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${sectionProgress}%`, background: accentHex, opacity: 0.65 }}
            />
          </div>
          <span
            className="text-[9px] font-bold tabular-nums leading-none"
            style={{ color: accentHex, opacity: 0.75 }}
          >
            {sectionProgress}%
          </span>
        </div>
      </div>

      <div className="relative w-full">
        <div className="relative grid grid-cols-2 gap-x-4 gap-y-4 py-2 z-10">
          {list.length === 0 ? (
            <span className="text-(--muted) col-span-2">No levels available.</span>
          ) : (
            list.map((item, index) => {
              const palette = colors && colors.length > 0 ? colors : [
                "pink", "orangered", "blue", "pale_blue", "opal",
                "orange", "pale_green", "yellow", "green",
              ];
              const color = palette[index % palette.length] ?? palette[0];
              const side = index % 2 === 0 ? "left" : "right";

              return (
                <div key={item.id} className="flex justify-center">
                  <LevelWord
                    {...item}
                    color={color}
                    animationIndex={index}
                    side={side}
                  />
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
