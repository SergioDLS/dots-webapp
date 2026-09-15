"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { getMyStatsService, type MyStats } from "@/services/engagement.service";
import { UiIcon } from "@/components/ui/ui-icon";
import { levelProgress } from "@/lib/level-math";

/**
 * HUD superior de las pantallas hub, sin marcos (spec §3.3): llama encendida
 * solo si la racha de hoy está asegurada, gemas y nivel con barra degradada.
 * Consume /me/stats; sin sesión degrada a ceros.
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

  const { pct } = stats ? levelProgress(stats.xp, stats.level, stats.xpForNextLevel) : { pct: 0 };
  // Sin el campo (backend viejo) la llama sigue la racha, como hasta ahora.
  const lit = stats ? (stats.streakSecuredToday ?? stats.streak > 0) : false;

  return (
    <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-(--border) bg-(--background)/85 px-4 py-2.5 backdrop-blur-md md:px-8">
      {/* Racha: llama + número, sin pastilla. Apagada = gris y atenuada. */}
      <div
        className="flex items-center gap-1 font-black tabular-nums"
        title={lit ? "Racha asegurada hoy" : "Practica hoy para encender la racha"}
        style={{ color: lit ? "var(--flame-edge)" : "var(--muted)" }}
      >
        <span
          className="inline-flex transition-[filter,opacity] duration-300"
          style={{ filter: lit ? "none" : "grayscale(1)", opacity: lit ? 1 : 0.45 }}
        >
          <UiIcon name="racha" size={22} />
        </span>
        <span className="text-sm">{stats?.streak ?? 0}</span>
      </div>

      {/* Gemas → tienda */}
      <Link
        href="/shop"
        className="flex items-center gap-1 font-black tabular-nums transition-transform active:scale-95"
        style={{ color: "var(--gem-edge)" }}
        title="Tienda"
      >
        <UiIcon name="gemas" size={22} />
        <span className="text-sm">{stats?.gems ?? 0}</span>
      </Link>

      {/* Nivel + XP */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="flex shrink-0 items-center gap-1 text-xs font-black text-foreground">
          <UiIcon name="xp" size={20} /> Nv {stats?.level ?? 1}
        </span>
        <div
          className="h-2 min-w-0 flex-1 overflow-hidden rounded-full"
          role="progressbar"
          aria-label="Progreso de nivel"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{ background: "var(--border)" }}
        >
          <div
            className="h-full rounded-full transition-[width] duration-700"
            style={{ width: `${pct}%`, background: "linear-gradient(90deg, var(--primary), var(--accent))" }}
          />
        </div>
        <span className="shrink-0 text-[11px] font-extrabold tabular-nums text-(--muted)">
          {stats ? `${stats.xp}/${stats.xpForNextLevel}` : "—"} XP
        </span>
      </div>
    </header>
  );
}
