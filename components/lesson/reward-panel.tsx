"use client";

import { useEffect, useState } from "react";

import type { ProgressReward } from "@/services/engagement.service";

/** Hitos de racha que merecen una celebración extra */
const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100];

/** Cuenta un número de 0 a `target` con easing, para el conteo de XP. */
function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target <= 0) {
      setValue(0);
      return;
    }
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
  return value;
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

  let delay = 0;
  const nextDelay = () => {
    const d = delay;
    delay += 0.12;
    return `${d}s`;
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {reward.xpGained > 0 && (
          <span
            className={chipCls}
            style={{
              background: "color-mix(in srgb, var(--gold) 18%, transparent)",
              border: "2px solid color-mix(in srgb, var(--gold) 45%, transparent)",
              color: "var(--gold-edge)",
              animation: `dots-pop-in 0.4s ease-out ${nextDelay()} both`,
            }}
          >
            ✨ +{xp} XP
          </span>
        )}
        {reward.streakUp && (
          <span
            className={chipCls}
            style={{
              background: "color-mix(in srgb, var(--flame) 16%, transparent)",
              border: "2px solid color-mix(in srgb, var(--flame) 40%, transparent)",
              color: "var(--flame-edge)",
              animation: `dots-pop-in 0.4s ease-out ${nextDelay()} both`,
            }}
          >
            🔥 Día {reward.streak}
          </span>
        )}
        {reward.freezeUsed && (
          <span
            className={chipCls}
            style={{
              background: "rgba(56,189,248,0.14)",
              border: "2px solid rgba(56,189,248,0.4)",
              color: "#0284c7",
              animation: `dots-pop-in 0.4s ease-out ${nextDelay()} both`,
            }}
          >
            ❄️ ¡Un escudo salvó tu racha!
          </span>
        )}
        {reward.freezeEarned && (
          <span
            className={chipCls}
            style={{
              background: "rgba(56,189,248,0.14)",
              border: "2px solid rgba(56,189,248,0.4)",
              color: "#0284c7",
              animation: `dots-pop-in 0.4s ease-out ${nextDelay()} both`,
            }}
          >
            ❄️ ¡Ganaste un escudo de racha!
          </span>
        )}
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
