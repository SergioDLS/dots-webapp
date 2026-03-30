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

  // Clustered layout: items arranged in rows with slight overlap/offsets
  return (
    <div className="flex w-full flex-col gap-6" data-section-id={id}>
      <div className="w-full flex items-center justify-center">
        <span
          className="text-2xl font-semibold text-foreground flex items-center gap-3 px-3 py-1 rounded-md bg-white/6 backdrop-blur-sm border border-white/8"
          style={{ boxShadow: `0 8px 30px ${accentHex}22` }}
        >
          <span className="w-3 h-3 rounded-full" style={{ background: accentHex, boxShadow: `0 6px 20px ${accentHex}33` }} />
          <span className="leading-tight">{name}</span>
        </span>
      </div>

      <div className="relative w-full">
        <div className="flex flex-col items-center py-6 px-4 z-10">
          {list.length === 0 ? (
            <span className="text-(--muted)">No levels available.</span>
          ) : (
            list.map((item, index) => {
              const palette = colors && colors.length > 0 ? colors : [
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
              const color = palette[index % palette.length] ?? palette[0];

              // horizontal offset that creates a gentle curve; smaller amplitude so nodes stay centered
              // increase amplitude significantly for a wide, pronounced curve
              const amplitude = 160; // px max offset (much wider curve)
              // lower frequency so nodes alternate across the curve more naturally
              const offsetX = Math.round(Math.sin(index * 0.7) * amplitude);
              const zIndex = 1000 - index;

              // non-overlapping layout: use small positive gap so nodes don't overlap
              const gap = 12; // px vertical gap between nodes

              return (
                <div
                  key={item.id}
                  style={{
                    transform: `translateX(${offsetX}px)`,
                    zIndex,
                    transition: "transform 320ms cubic-bezier(.2,.9,.2,1)",
                    transitionDelay: `${index * 16}ms`,
                    marginBottom: `${gap}px`,
                  }}
                  className="relative"
                >
                  <LevelWord
                    {...item}
                    color={color}
                    animationIndex={index}
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
