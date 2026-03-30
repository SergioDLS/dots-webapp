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

  return (
  <div className="flex w-full flex-col items-center gap-4" data-section-id={id}>
      <span className="text-2xl font-semibold text-foreground">{name}</span>
      <div className="relative w-full">
        {/* vertical connector line behind nodes */}
        <div className="absolute left-1/2 -translate-x-1/2 top-6 bottom-6 w-px bg-(--border) opacity-30 z-0" />

        <div className="flex flex-col items-center gap-8 py-6 px-4 z-10">
          {list.length === 0 ? (
            <span className="text-(--muted)">No levels available.</span>
          ) : (
            list.map((item, index) => {

              console.log(item);
              
              // choose color from parent palette if provided, otherwise fallback to id-derived
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
              return (
                <div className="relative" key={item.id} style={{ transitionDelay: `${index * 80}ms` }}>
                  <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px" aria-hidden />
                  <LevelWord {...item} color={color} animationIndex={index} />
                  {/* connector curve between this node and the next */}
                  {index < list.length - 1 && (
                    <div className="flex items-center justify-center -mt-2">
                      <svg width="36" height="28" viewBox="0 0 36 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                        <path d="M18 0 C18 8 18 20 18 28" stroke="currentColor" strokeWidth="2" strokeOpacity="0.18" strokeLinecap="round" />
                      </svg>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
