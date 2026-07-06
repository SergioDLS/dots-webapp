"use client";

import React, { useEffect, useMemo, useState } from "react";

interface ConfettiProps {
  /** re-fire the burst whenever this value changes */
  burstKey?: string | number;
  /** number of pieces */
  count?: number;
}

const COLORS = [
  "var(--accent)",
  "var(--purple)",
  "var(--sun)",
  "var(--success)",
  "var(--accent-soft)",
];

/**
 * Lightweight CSS confetti burst — no dependencies.
 * Renders absolutely inside its nearest positioned parent.
 */
export default function Confetti({ burstKey = 0, count = 26 }: ConfettiProps) {
  // Only render after mount: pieces are randomized, so SSR markup
  // can never match the client and would trigger hydration errors.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const dist = 90 + Math.random() * 130;
        return {
          cx: Math.cos(angle) * dist,
          cy: Math.sin(angle) * dist - 60,
          cr: (Math.random() > 0.5 ? 1 : -1) * (240 + Math.random() * 360),
          color: COLORS[i % COLORS.length],
          w: 6 + Math.random() * 6,
          h: 8 + Math.random() * 8,
          delay: Math.random() * 0.12,
          round: Math.random() > 0.6,
        };
      }),
    // regenerate on every burst so each celebration looks different
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [burstKey, count],
  );

  if (!mounted) return null;

  return (
    <div
      key={burstKey}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center overflow-hidden"
    >
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute"
          style={
            {
              width: p.w,
              height: p.h,
              background: p.color,
              borderRadius: p.round ? "50%" : "2px",
              "--cx": `${p.cx}px`,
              "--cy": `${p.cy}px`,
              "--cr": `${p.cr}deg`,
              animation: `confetti-burst 0.9s cubic-bezier(.14,.6,.36,1) ${p.delay}s both`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
