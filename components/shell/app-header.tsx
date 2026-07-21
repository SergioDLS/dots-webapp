"use client";

import { useEffect, useState } from "react";

import { getMyStatsService, type MyStats } from "@/services/engagement.service";

/**
 * HUD superior de las pantallas hub: racha (llama), nivel y progreso de XP.
 * Consume el endpoint existente /me/stats. Si no hay sesión/stats, no
 * renderiza cifras (degrada sin romper). Las gemas se añaden en Fase 5.
 * Fórmula de nivel (contrato backend): level = floor(sqrt(xp/100)) + 1,
 * el nivel actual empieza en 100 * (level - 1)^2 XP.
 */
export default function AppHeader() {
  const [stats, setStats] = useState<MyStats | null>(null);

  useEffect(() => {
    let mounted = true;
    getMyStatsService().then((data) => {
      if (mounted && data) setStats(data);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const levelStart = stats ? 100 * (stats.level - 1) * (stats.level - 1) : 0;
  const span = stats ? Math.max(1, stats.xpForNextLevel - levelStart) : 1;
  const pct = stats
    ? Math.min(100, Math.max(0, Math.round(((stats.xp - levelStart) / span) * 100)))
    : 0;

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-(--border) bg-(--background)/85 px-4 py-2.5 backdrop-blur-md md:px-8">
      {/* Racha */}
      <div
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 font-black tabular-nums"
        style={{
          background: "color-mix(in srgb, var(--flame) 14%, transparent)",
          border: "1.5px solid color-mix(in srgb, var(--flame) 38%, transparent)",
          color: "var(--flame-edge)",
        }}
        title="Racha diaria"
      >
        <span className="text-base leading-none">🔥</span>
        <span className="text-sm">{stats?.streak ?? 0}</span>
      </div>

      {/* Nivel + XP */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black"
          style={{
            background: "color-mix(in srgb, var(--primary) 14%, transparent)",
            border: "1.5px solid color-mix(in srgb, var(--primary) 35%, transparent)",
            color: "var(--primary)",
          }}
        >
          ⭐ Nivel {stats?.level ?? 1}
        </span>
        <div
          className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full"
          role="progressbar"
          aria-label="Progreso de nivel"
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
        <span className="shrink-0 text-[11px] font-extrabold tabular-nums text-(--muted)">
          {stats ? `${stats.xp}/${stats.xpForNextLevel}` : "—"} XP
        </span>
      </div>
    </header>
  );
}
