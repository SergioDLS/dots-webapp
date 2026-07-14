"use client";

import React from "react";
import type { ScoreResult } from "@/services/engagement.service";

/**
 * "+N XP" / "New high score!" badges for game end screens.
 * Renders nothing until the (fire-and-forget) score POST resolves.
 */
export default function XpReward({ reward }: { reward: ScoreResult | null }) {
  if (!reward) return null;
  if (reward.xpGained <= 0 && !reward.isNewHighScore) return null;

  return (
    <div
      className="flex flex-col items-center gap-1.5"
      style={{ animation: "dots-pop-in 0.4s ease-out both" }}
    >
      {reward.xpGained > 0 && (
        <span
          className="rounded-full px-4 py-1.5 text-sm font-black"
          style={{
            background: "color-mix(in srgb, var(--gold) 18%, transparent)",
            border: "2px solid color-mix(in srgb, var(--gold) 45%, transparent)",
            color: "var(--gold-edge)",
          }}
        >
          ✨ +{reward.xpGained} XP
        </span>
      )}
      {reward.isNewHighScore && (
        <span
          className="text-sm font-extrabold text-(--accent)"
          style={{ animation: "dots-wiggle 1.2s ease-in-out infinite" }}
        >
          🏆 New high score!
        </span>
      )}
    </div>
  );
}
