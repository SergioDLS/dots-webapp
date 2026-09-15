"use client";

import { levelLine } from "@/lib/profile-view";
import { levelProgress } from "@/lib/level-math";
import type { MyStats } from "@/services/engagement.service";

/** Barra de nivel del perfil (spec §5): "Nivel 4 · 620 / 900 XP" y la barra. */
export default function ProfileXpBar({ stats }: { stats: MyStats | null }) {
  const { pct } = levelProgress(stats?.xp ?? 0, stats?.level ?? 1, stats?.xpForNextLevel ?? 0);
  return (
    <div className="flex w-full flex-col gap-1.5">
      <span className="text-xs font-extrabold tabular-nums text-(--muted)">{levelLine(stats)}</span>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full"
        role="progressbar"
        aria-label="Progreso de nivel"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{ background: "var(--border)" }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%`, background: "linear-gradient(90deg, var(--primary), var(--accent))" }}
        />
      </div>
    </div>
  );
}
