"use client";

import React, { useCallback, useEffect, useState } from "react";
import Confetti from "../ui/confetti/confetti";
import {
  getMyQuestService,
  claimQuestService,
  type DailyQuest,
} from "../../services/engagement.service";

/**
 * Daily quest card for the sidebar. Hidden entirely when the quest
 * can't be fetched (not logged in, backend not ready, ...).
 */
export default function DailyQuestCard({
  onClaimed,
}: {
  /** called after a successful claim so the parent can refresh stats */
  onClaimed?: () => void;
}) {
  const [quest, setQuest] = useState<DailyQuest | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [justClaimed, setJustClaimed] = useState<number | null>(null);

  const load = useCallback(() => {
    getMyQuestService().then(setQuest);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!quest) return null;

  const pct = Math.min(
    100,
    Math.max(0, Math.round((quest.progress / Math.max(1, quest.goal)) * 100)),
  );

  const claim = () => {
    if (claiming) return;
    setClaiming(true);
    claimQuestService()
      .then((res) => {
        setJustClaimed(res.xpGained);
        setQuest((q) => (q ? { ...q, claimed: true } : q));
        onClaimed?.();
      })
      .catch(() => {
        // 400 = already claimed / not completed — resync with the server
        load();
      })
      .finally(() => setClaiming(false));
  };

  return (
    <div
      className="dots-card relative overflow-hidden p-4 flex flex-col gap-2.5"
      style={{ animation: "dots-pop-in 0.35s ease-out both" }}
    >
      {justClaimed !== null && <Confetti burstKey="quest-claim" count={26} />}

      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-(--muted)">
          🗓️ Misión del día
        </span>
        <span className="text-[10px] font-extrabold text-(--muted) tabular-nums">
          {Math.min(quest.progress, quest.goal)}/{quest.goal}
        </span>
      </div>

      <p className="text-sm font-extrabold text-foreground leading-snug">
        {quest.title}
      </p>

      {/* Progress bar */}
      <div
        className="h-2.5 w-full overflow-hidden rounded-full"
        role="progressbar"
        aria-label="Quest progress"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{ background: "var(--border)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: quest.completed
              ? "var(--success)"
              : "linear-gradient(90deg, var(--primary), var(--accent))",
          }}
        />
      </div>

      {/* State line */}
      {quest.claimed ? (
        <p className="text-xs font-extrabold text-(--success)">
          ¡Listo por hoy! ✅
          {justClaimed !== null && justClaimed > 0 && (
            <span
              className="ml-2 text-(--gold-edge)"
              style={{ animation: "dots-pop-in 0.4s ease-out both" }}
            >
              ✨ +{justClaimed} XP
            </span>
          )}
        </p>
      ) : quest.completed ? (
        <button
          onClick={claim}
          disabled={claiming}
          className="dots-pressable mt-0.5 w-full rounded-2xl px-4 py-2.5 text-sm font-black disabled:opacity-60"
          style={{
            background: "var(--accent)",
            color: "var(--accent-contrast)",
            ["--press-color" as string]: "var(--accent-edge)",
            ["--pulse-color" as string]:
              "color-mix(in srgb, var(--accent) 40%, transparent)",
            animation: claiming
              ? "none"
              : "dots-pulse-ring 1.6s ease-out infinite",
          }}
        >
          {claiming ? "Reclamando..." : `Reclamar +${quest.reward} XP 🎁`}
        </button>
      ) : (
        <p className="text-xs font-bold text-(--muted)">
          ¡Sigue! Te espera un premio 🎁
        </p>
      )}
    </div>
  );
}
