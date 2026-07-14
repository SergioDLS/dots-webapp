"use client";

import React from "react";
import Doty from "@/components/ui/doty/doty";

// Presentational hot-air balloon for Don't Pop. Pure display: the page owns
// the pressure/game state and this component just renders it.
//
// `pressure` is 0..1 — the envelope swells, reddens and finally trembles as
// it approaches 1. `phase` drives the three scene states: flying (bobbing in
// the air), exploded (envelope bursts and Doty + basket tumble down) and
// landed (gentle touchdown on the ground after a win).

export type BalloonPhase = "flying" | "exploded" | "landed";

const GORES = [
  "var(--accent)",
  "var(--sun)",
  "var(--purple)",
  "var(--success)",
  "var(--accent)",
  "var(--sun)",
  "var(--purple)",
];

export default function HotAirBalloon({
  pressure,
  phase,
}: {
  pressure: number; // 0..1
  phase: BalloonPhase;
}) {
  const danger = Math.max(0, Math.min(1, pressure));
  const scale = 1 + danger * 0.38;
  const trembling = phase === "flying" && danger > 0.72;

  return (
    <div
      className="relative flex flex-col items-center"
      style={{
        animation:
          phase === "flying"
            ? "dp-bob 3s ease-in-out infinite"
            : phase === "landed"
              ? "dp-land 1.2s ease-out both"
              : undefined,
      }}
    >
      <style>{`
        @keyframes dp-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-14px); }
        }
        @keyframes dp-tremble {
          0%, 100% { transform: rotate(-2.5deg); }
          50% { transform: rotate(2.5deg); }
        }
        @keyframes dp-land {
          from { transform: translateY(-40px); }
          to { transform: translateY(0); }
        }
        @keyframes dp-burst {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(2.1); opacity: 0; }
        }
        @keyframes dp-fall {
          0% { transform: translateY(0) rotate(0deg); }
          100% { transform: translateY(260px) rotate(50deg); }
        }
        @keyframes dp-shard {
          to { transform: translate(var(--sx), var(--sy)) rotate(var(--sr)); opacity: 0; }
        }
      `}</style>

      {/* Envelope */}
      {phase !== "exploded" ? (
        <div
          style={{
            transform: `scale(${phase === "landed" ? 0.92 : scale})`,
            transformOrigin: "bottom center",
            transition: "transform 0.25s ease-out, filter 0.3s ease-out",
            filter:
              danger > 0.55 && phase === "flying"
                ? `hue-rotate(-${Math.round((danger - 0.55) * 90)}deg) saturate(${1 + danger * 0.8})`
                : undefined,
            animation: trembling ? "dp-tremble 0.18s linear infinite" : undefined,
          }}
        >
          <svg width="150" height="170" viewBox="0 0 150 170" aria-hidden>
            {/* gores: vertical slices of the envelope */}
            {GORES.map((color, i) => {
              const n = GORES.length;
              // each gore is a vertical lens from apex (75,4) to throat (75,138)
              const spread = 70 * (1 - Math.abs((i - (n - 1) / 2) / ((n - 1) / 2)) * 0.15);
              const cx = 75 + (i - (n - 1) / 2) * (spread / ((n - 1) / 2 + 0.4));
              const w = 46 - Math.abs(i - (n - 1) / 2) * 9;
              return (
                <path
                  key={i}
                  d={`M75 4 C ${cx - w} 30, ${cx - w} 100, 75 138 C ${cx + w} 100, ${cx + w} 30, 75 4 Z`}
                  fill={color}
                  opacity={0.94}
                />
              );
            })}
            {/* sheen */}
            <ellipse cx="56" cy="46" rx="16" ry="26" fill="white" opacity="0.22" />
            {/* throat ring */}
            <rect x="61" y="134" width="28" height="9" rx="4" fill="#8a5a2b" />
          </svg>
        </div>
      ) : (
        // Burst: expanding ring + flying shards where the envelope was
        <div className="relative h-[170px] w-[150px]">
          <div
            className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-8"
            style={{
              borderColor: "var(--danger)",
              animation: "dp-burst 0.55s ease-out both",
            }}
          />
          {GORES.slice(0, 6).map((color, i) => (
            <span
              key={i}
              className="absolute left-1/2 top-1/2 block h-5 w-8 rounded-full"
              style={
                {
                  background: color,
                  "--sx": `${Math.cos((i / 6) * Math.PI * 2) * 110}px`,
                  "--sy": `${Math.sin((i / 6) * Math.PI * 2) * 90 - 40}px`,
                  "--sr": `${120 + i * 60}deg`,
                  animation: "dp-shard 0.7s ease-out both",
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      )}

      {/* Ropes + basket + Doty. On explosion this whole group falls. */}
      <div
        className="-mt-1 flex flex-col items-center"
        style={{
          animation:
            phase === "exploded" ? "dp-fall 1.1s cubic-bezier(0.3, 0, 0.8, 0.4) both" : undefined,
        }}
      >
        <svg width="70" height="26" viewBox="0 0 70 26" aria-hidden>
          <line x1="12" y1="0" x2="22" y2="26" stroke="#8a5a2b" strokeWidth="2.5" />
          <line x1="58" y1="0" x2="48" y2="26" stroke="#8a5a2b" strokeWidth="2.5" />
        </svg>
        <div className="relative">
          {/* Doty peeking out of the basket */}
          <div className="absolute -top-9 left-1/2 -translate-x-1/2">
            <Doty
              pose={phase === "exploded" ? "05" : phase === "landed" ? "02" : "14"}
              size="micro"
              animation={phase === "landed" ? "cheer" : "none"}
            />
          </div>
          <svg width="64" height="40" viewBox="0 0 64 40" aria-hidden className="relative">
            <rect x="2" y="2" width="60" height="36" rx="8" fill="#a86a32" />
            <rect x="2" y="2" width="60" height="36" rx="8" fill="url(#dpWeave)" opacity="0.35" />
            <defs>
              <pattern id="dpWeave" width="8" height="8" patternUnits="userSpaceOnUse">
                <path d="M0 4 H8 M4 0 V8" stroke="#5e3a17" strokeWidth="1.5" />
              </pattern>
            </defs>
            <rect x="2" y="2" width="60" height="7" rx="3.5" fill="#8a5a2b" />
          </svg>
        </div>
      </div>
    </div>
  );
}
