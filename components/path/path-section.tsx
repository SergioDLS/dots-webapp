"use client";

import React, { useState } from "react";
import PathNode, { NODE_SVG_SIZE, CHECKPOINT_SVG_SIZE } from "./path-node";
import DotyMarker from "./doty-marker";
import type { PathSection as PathSectionType } from "@/types/path.types";

interface PathSectionProps {
  section: PathSectionType;
  accentHex: string;
}

/* ── Zigzag helpers (evolved from level-section) ────────────── */
// Pattern repeats every 4 items: left → center → right → center → …
const zigzagX = (i: number): number => {
  const phase = i % 4;
  if (phase === 0) return 15;
  if (phase === 1) return 50;
  if (phase === 2) return 85;
  return 50;
};

const LABEL_H = 30; // px – title under the circle
const ROW_GAP = 18; // px – vertical gap between nodes
const NODE_W = 150; // px – node wrapper width

export default function PathSection({ section, accentHex }: PathSectionProps) {
  const { id, name, progress, skipped, checkpointAvailable, nodes } = section;
  const [openKey, setOpenKey] = useState<string | null>(null);

  const pct = Math.max(0, Math.min(100, Math.round(progress ?? 0)));

  // Per-node slot geometry (checkpoint is bigger, always centered)
  const slots = nodes.map((n, i) => {
    const isCp = n.type === "checkpoint";
    return {
      node: n,
      key: `${n.type}-${n.id}`,
      xPct: isCp ? 50 : zigzagX(i),
      svg: isCp ? CHECKPOINT_SVG_SIZE : NODE_SVG_SIZE,
      h: (isCp ? CHECKPOINT_SVG_SIZE : NODE_SVG_SIZE) + LABEL_H,
    };
  });
  const offsets = slots.map((_, i) =>
    slots.slice(0, i).reduce((sum, s) => sum + s.h + ROW_GAP, 0),
  );
  const placed = slots.map((s, i) => ({
    ...s,
    y: offsets[i],
    centerY: offsets[i] + s.svg / 2,
  }));
  const totalH =
    slots.length === 0
      ? 0
      : offsets[slots.length - 1] + slots[slots.length - 1].h;

  // Connector: one cubic segment per consecutive pair; travelled part solid
  const segment = (
    a: { xPct: number; centerY: number },
    b: { xPct: number; centerY: number },
  ) => {
    const midY = (a.centerY + b.centerY) / 2;
    return `M ${a.xPct} ${a.centerY} C ${a.xPct} ${midY}, ${b.xPct} ${midY}, ${b.xPct} ${b.centerY}`;
  };

  return (
    <div className="flex w-full flex-col gap-4 items-center" data-section-id={id}>
      {/* ── Section header ─────────────────────────────────── */}
      <div className="w-full flex flex-col items-center gap-1.5">
        <span className="font-display text-2xl font-bold text-foreground flex items-center gap-3">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ background: accentHex }}
          />
          {name}
          {skipped && (
            <span
              className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{
                background: "color-mix(in srgb, var(--gold) 18%, var(--surface))",
                border: "1.5px solid var(--gold)",
                color: "var(--gold-edge)",
              }}
            >
              Superada
            </span>
          )}
        </span>
        <div className="w-40 flex items-center gap-1.5">
          <div
            className="flex-1 h-1 rounded-full overflow-hidden"
            style={{ background: "color-mix(in srgb, var(--foreground) 8%, transparent)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${pct}%`, background: accentHex, opacity: 0.65 }}
            />
          </div>
          <span
            className="text-[9px] font-bold tabular-nums leading-none"
            style={{ color: accentHex, opacity: 0.75 }}
          >
            {pct}%
          </span>
        </div>
      </div>

      {/* ── Path (zigzag + connector) ──────────────────────── */}
      {placed.length === 0 ? (
        <span className="text-(--muted)">No hay lecciones disponibles.</span>
      ) : (
        <div className="relative w-full" style={{ maxWidth: 520, height: totalH }}>
          {/* SVG connector: solid where already travelled, dashed ahead */}
          {placed.length >= 2 && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox={`0 0 100 ${totalH}`}
              preserveAspectRatio="none"
              fill="none"
            >
              {placed.slice(0, -1).map((p, i) => {
                const next = placed[i + 1];
                const travelled = p.node.completed;
                return (
                  <path
                    key={p.key}
                    d={segment(p, next)}
                    stroke={accentHex}
                    strokeWidth={travelled ? 3.5 : 2.5}
                    strokeDasharray={travelled ? undefined : "6 6"}
                    strokeLinecap="round"
                    opacity={travelled ? 0.55 : 0.3}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </svg>
          )}

          {/* Nodes */}
          {placed.map((p, index) => (
            <div
              key={p.key}
              className="absolute"
              data-path-current={p.node.current ? "true" : undefined}
              style={{
                left: `calc(${p.xPct}% - ${NODE_W / 2}px)`,
                top: p.y,
                width: NODE_W,
                zIndex: openKey === p.key ? 40 : 1,
              }}
            >
              <PathNode
                node={p.node}
                accentHex={accentHex}
                checkpointAvailable={checkpointAvailable}
                animationIndex={index}
                open={openKey === p.key}
                onOpenChange={(v) => setOpenKey(v ? p.key : null)}
                popoverAlign={p.xPct < 35 ? "left" : p.xPct > 65 ? "right" : "center"}
              />
              {p.node.current && (
                <DotyMarker side={p.xPct >= 50 ? "left" : "right"} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
