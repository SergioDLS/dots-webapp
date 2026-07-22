"use client";

import React, { useEffect, useState } from "react";
import { getRivalService, type RivalData } from "@/services/engagement.service";

// ── Component ─────────────────────────────────────────────────────────────────

export default function RivalBanner() {
  const [rival, setRival] = useState<RivalData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getRivalService()
      .then((data) => {
        if (active) setRival(data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div
        className="rounded-2xl border border-(--border) bg-(--surface) p-3 animate-pulse"
        style={{ minHeight: "3.5rem" }}
      />
    );
  }

  // No rival data at all (backend error, not ranked, or #1 with no one ahead)
  if (!rival) return null;

  const { above, below } = rival;

  // User is #1 — no one above
  if (!above && !below) return null;

  return (
    <div
      className="rounded-2xl border border-(--border) bg-(--surface) p-3 flex flex-col gap-2"
      style={{ animation: "dots-pop-in 0.35s ease-out both" }}
    >
      {/* Above rival — the main motivator */}
      {above && (
        <div className="flex items-center gap-2">
          <span className="text-lg select-none" aria-hidden>
            🎯
          </span>
          <p className="text-sm flex-1" style={{ color: "var(--foreground)" }}>
            Estás a{" "}
            <span
              className="font-black tabular-nums"
              style={{ color: "var(--accent)" }}
            >
              {above.delta.toLocaleString()} XP
            </span>{" "}
            de superar a{" "}
            <span className="font-bold">{above.name}</span>.{" "}
            <span style={{ color: "var(--muted)" }}>¡Dale!</span>
          </p>
        </div>
      )}

      {/* No one above = user is #1 this week */}
      {!above && (
        <div className="flex items-center gap-2">
          <span className="text-lg select-none" aria-hidden>
            👑
          </span>
          <p className="text-sm font-bold" style={{ color: "var(--accent)" }}>
            ¡Eres el #1 de la semana! Nadie te alcanza.
          </p>
        </div>
      )}

      {/* Below rival — threat message */}
      {below && (
        <div className="flex items-center gap-2">
          <span className="text-lg select-none" aria-hidden>
            🛡️
          </span>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            <span className="font-bold" style={{ color: "var(--foreground)" }}>
              {below.name}
            </span>{" "}
            está a{" "}
            <span className="font-bold tabular-nums">
              {below.delta.toLocaleString()} XP
            </span>{" "}
            de alcanzarte — no aflojes.
          </p>
        </div>
      )}
    </div>
  );
}
