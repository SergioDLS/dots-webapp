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
  current?: boolean;
};

interface LevelSectionProps {
  id: number;
  name: string;
  levels?: LevelItem[];
  colors?: string[];
}

/* ── Zigzag helpers ─────────────────────────────────────────── */
// Pattern repeats every 4 items: left → center → right → center → …
const zigzagX = (i: number): number => {
  const phase = i % 4;
  if (phase === 0) return 15;   // left
  if (phase === 1) return 50;   // center
  if (phase === 2) return 85;   // right
  return 50;                    // center
};

const NODE_SIZE = 150;   // px – each node placeholder height (circle + label + gap)
const ROW_GAP   = 24;    // px – vertical gap between nodes

export default function LevelSection({ id, name, levels, colors }: LevelSectionProps) {
  const list = levels ?? [];
  const accent = (colors && colors.length > 0 ? colors[0] : "pink") || "pink";
  const colorHexMap: Record<string, string> = {
    pink: "#F472B6", orangered: "#F97316", blue: "#1D4ED8",
    pale_blue: "#7DD3FC", opal: "#5EEAD4", orange: "#FBBF24",
    pale_green: "#BEF264", yellow: "#FACC15", green: "#34D399",
  };
  const accentHex = colorHexMap[accent] ?? colorHexMap.pink;

  const sectionProgress =
    list.length > 0
      ? Math.round(list.reduce((sum, l) => sum + (l.progress ?? 0), 0) / list.length)
      : 0;

  // Compute node center positions for the SVG connector path
  const totalH = list.length > 0 ? list.length * (NODE_SIZE + ROW_GAP) - ROW_GAP : 0;
  const points = list.map((_, i) => ({
    x: zigzagX(i),                                       // percent → we'll convert later
    y: i * (NODE_SIZE + ROW_GAP) + NODE_SIZE / 2,        // px center
  }));

  // Build a smooth SVG path from the node center points
  const buildPath = (): string => {
    if (points.length < 2) return "";
    // Convert % x to px based on a nominal 100-unit viewBox width
    const pts = points.map((p) => ({ x: p.x, y: p.y }));
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const curr = pts[i];
      const next = pts[i + 1];
      const midY = (curr.y + next.y) / 2;
      d += ` C ${curr.x} ${midY}, ${next.x} ${midY}, ${next.x} ${next.y}`;
    }
    return d;
  };

  return (
    <div className="flex w-full flex-col gap-4 items-center" data-section-id={id}>

      {/* Section header */}
      <div className="w-full flex flex-col items-center gap-1.5">
        <span className="text-2xl font-semibold text-foreground flex items-center gap-3">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ background: accentHex }}
          />
          {name}
        </span>
        <div className="w-40 flex items-center gap-1.5">
          <div
            className="flex-1 h-1 rounded-full overflow-hidden"
            style={{ background: "rgba(0,0,0,0.08)" }}
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

      {/* ── Zigzag path container ─────────────────────────── */}
      {list.length === 0 ? (
        <span className="text-(--muted)">No levels available.</span>
      ) : (
        <div className="relative w-full" style={{ maxWidth: 480, height: totalH }}>

          {/* SVG connector line */}
          {points.length >= 2 && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox={`0 0 100 ${totalH}`}
              preserveAspectRatio="none"
              fill="none"
            >
              <path
                d={buildPath()}
                stroke={accentHex}
                strokeWidth="2.5"
                strokeDasharray="6 6"
                strokeLinecap="round"
                opacity={0.3}
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          )}

          {/* Nodes */}
          {list.map((item, index) => {
            const palette = colors && colors.length > 0 ? colors : [
              "pink", "orangered", "blue", "pale_blue", "opal",
              "orange", "pale_green", "yellow", "green",
            ];
            const color = palette[index % palette.length] ?? palette[0];
            const xPct = zigzagX(index);
            const yPx  = index * (NODE_SIZE + ROW_GAP);

            return (
              <div
                key={item.id}
                className="absolute"
                style={{
                  left: `${xPct}%`,
                  top: yPx,
                  transform: "translateX(-50%)",
                  width: 140,
                }}
              >
                <LevelWord
                  {...item}
                  color={color}
                  current={item.current ?? false}
                  animationIndex={index}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
