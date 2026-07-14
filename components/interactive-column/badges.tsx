"use client";

import React, { useEffect, useState } from "react";
import {
  getMyBadgesService,
  type Badge,
} from "../../services/engagement.service";

/**
 * Compact expandable badges card for the sidebar.
 * Hidden entirely when badges can't be fetched or the list is empty.
 */
export default function BadgesCard() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    getMyBadgesService().then((data) => {
      if (active) setBadges(data);
    });
    return () => {
      active = false;
    };
  }, []);

  if (badges.length === 0) return null;

  const earnedCount = badges.filter((b) => b.earned).length;

  return (
    <div
      className="dots-card overflow-hidden"
      style={{ animation: "dots-pop-in 0.35s ease-out both" }}
    >
      {/* Toggle header */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-(--accent)/6"
      >
        <span className="text-[10px] font-bold uppercase tracking-widest text-(--muted)">
          🏅 My badges
        </span>
        <span className="flex items-center gap-2">
          <span className="text-[10px] font-extrabold text-(--accent) tabular-nums">
            {earnedCount}/{badges.length}
          </span>
          <span
            aria-hidden
            className="text-xs text-(--muted) transition-transform duration-200"
            style={{ transform: open ? "rotate(180deg)" : "none" }}
          >
            ▼
          </span>
        </span>
      </button>

      {/* Grid */}
      {open && (
        <div
          className="grid grid-cols-3 gap-2 px-4 pb-4"
          style={{ animation: "dots-slide-up 0.25s ease-out both" }}
        >
          {badges.map((badge) => (
            <div
              key={badge.key}
              title={
                badge.earned
                  ? badge.title
                  : `${badge.title} — ${badge.progress}/${badge.goal}`
              }
              className="flex flex-col items-center gap-1 rounded-2xl px-1.5 py-2.5 text-center"
              style={{
                background: badge.earned
                  ? "color-mix(in srgb, var(--gold) 12%, transparent)"
                  : "var(--background)",
                border: badge.earned
                  ? "1.5px solid color-mix(in srgb, var(--gold) 40%, transparent)"
                  : "1.5px solid var(--border)",
              }}
            >
              <span
                className="text-2xl leading-none"
                style={
                  badge.earned
                    ? undefined
                    : { filter: "grayscale(1)", opacity: 0.4 }
                }
              >
                {badge.emoji}
              </span>
              <span
                className="text-[9px] font-extrabold leading-tight"
                style={{
                  color: badge.earned ? "var(--foreground)" : "var(--muted)",
                }}
              >
                {badge.title}
              </span>
              {!badge.earned && (
                <span className="text-[9px] font-bold text-(--muted) tabular-nums">
                  {badge.progress}/{badge.goal}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
