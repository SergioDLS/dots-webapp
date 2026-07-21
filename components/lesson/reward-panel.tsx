"use client";

import { useEffect, useState } from "react";

import type { ProgressReward } from "@/services/engagement.service";

/** Hitos de racha que merecen una celebración extra */
const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100];

/** Cuenta un número de 0 a `target` con easing, para el conteo de XP. */
function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target <= 0) return;
    let raf = 0;
    let start: number | null = null;
    const tick = (ts: number) => {
      if (start === null) start = ts;
      const t = Math.min(1, (ts - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setValue(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return target <= 0 ? 0 : value;
}

const chipCls = "rounded-full px-4 py-1.5 text-sm font-black";

/**
 * Chips de recompensa (+XP con conteo animado / racha / escudo), que llegan
 * async de PUT /sentences/progress. Cada chip aparece escalonado.
 */
export default function RewardPanel({ reward }: { reward: ProgressReward | null }) {
  const xp = useCountUp(reward?.xpGained ?? 0);

  if (
    !reward ||
    !(reward.xpGained > 0 || reward.streakUp || reward.freezeUsed || reward.freezeEarned)
  ) {
    return null;
  }

  // Chips visibles en orden, para escalonar la animación por índice sin
  // mutar variables durante el render (regla del compiler de React).
  type Chip = {
    key: string;
    background: string;
    border: string;
    color: string;
    content: string;
  };
  const chips: (Chip | false | undefined)[] = [
    reward.xpGained > 0 && {
      key: "xp",
      background: "color-mix(in srgb, var(--gold) 18%, transparent)",
      border: "2px solid color-mix(in srgb, var(--gold) 45%, transparent)",
      color: "var(--gold-edge)",
      content: `✨ +${xp} XP`,
    },
    reward.streakUp && {
      key: "streak",
      background: "color-mix(in srgb, var(--flame) 16%, transparent)",
      border: "2px solid color-mix(in srgb, var(--flame) 40%, transparent)",
      color: "var(--flame-edge)",
      content: `🔥 Día ${reward.streak}`,
    },
    reward.freezeUsed && {
      key: "freeze-used",
      background: "rgba(56,189,248,0.14)",
      border: "2px solid rgba(56,189,248,0.4)",
      color: "#0284c7",
      content: "❄️ ¡Un escudo salvó tu racha!",
    },
    reward.freezeEarned && {
      key: "freeze-earned",
      background: "rgba(56,189,248,0.14)",
      border: "2px solid rgba(56,189,248,0.4)",
      color: "#0284c7",
      content: "❄️ ¡Ganaste un escudo de racha!",
    },
  ].filter((c): c is Chip => Boolean(c));

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {chips.map((chip, i) => (
          <span
            key={chip.key}
            className={chipCls}
            style={{
              background: chip.background,
              border: chip.border,
              color: chip.color,
              animation: `dots-pop-in 0.4s ease-out ${i * 0.12}s both`,
            }}
          >
            {chip.content}
          </span>
        ))}
      </div>
      {reward.streakUp && STREAK_MILESTONES.includes(reward.streak) && (
        <p
          className="font-display text-xl font-extrabold text-center"
          style={{
            background: "linear-gradient(135deg, var(--accent), #fbbf24, #f97316)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            animation: "pc-streak-glow 2s ease-in-out infinite",
          }}
        >
          🎉 ¡Racha de {reward.streak} días! Increíble
        </p>
      )}
    </div>
  );
}
