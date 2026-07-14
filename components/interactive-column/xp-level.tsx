"use client";

import React, { useEffect, useState } from "react";
import {
  getMyStatsService,
  type MyStats,
} from "../../services/engagement.service";

/**
 * XP + level progress pill for the sidebar profile card.
 * Renders nothing when stats are unavailable (e.g. not logged in yet).
 * Level formula (backend contract): level = floor(sqrt(xp / 100)) + 1,
 * so the current level starts at 100 * (level - 1)^2 XP.
 */
export default function XpLevel() {
  const [stats, setStats] = useState<MyStats | null>(null);

  useEffect(() => {
    let active = true;
    getMyStatsService().then((data) => {
      if (active && data) setStats(data);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!stats) return null;

  const levelStart = 100 * (stats.level - 1) * (stats.level - 1);
  const span = Math.max(1, stats.xpForNextLevel - levelStart);
  const pct = Math.min(
    100,
    Math.max(0, Math.round(((stats.xp - levelStart) / span) * 100)),
  );

  return (
    <div
      className="flex flex-col gap-1 w-full"
      style={{ animation: "dots-pop-in 0.35s ease-out both" }}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-black"
          style={{
            background: "color-mix(in srgb, var(--primary) 14%, transparent)",
            border: "1.5px solid color-mix(in srgb, var(--primary) 35%, transparent)",
            color: "var(--primary)",
          }}
        >
          ⭐ Level {stats.level}
        </span>
        <span className="text-[10px] font-extrabold text-(--muted) tabular-nums">
          {stats.xp}/{stats.xpForNextLevel} XP
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full"
        role="progressbar"
        aria-label="Level progress"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{ background: "var(--border)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, var(--primary), var(--accent))",
          }}
        />
      </div>
    </div>
  );
}
