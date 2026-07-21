"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getTournamentService,
  type TournamentData,
} from "@/services/tournament.service";

// ── Countdown helper ──────────────────────────────────────────────────────────

function formatCountdown(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return "terminado";
  const totalSecs = Math.floor(ms / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TournamentCard() {
  const router = useRouter();
  const [data, setData] = useState<TournamentData | null>(null);
  const [loading, setLoading] = useState(true);
  // El texto del countdown se deriva en render; este tick solo fuerza el
  // re-render cada minuto (sin setState síncrono en el cuerpo del efecto).
  const [, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    getTournamentService()
      .then((d) => {
        if (active) setData(d);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  if (loading) {
    return (
      <div
        className="rounded-2xl border border-(--border) bg-(--surface) p-4 animate-pulse"
        style={{ minHeight: "8rem" }}
      />
    );
  }

  if (!data) return null;

  const { gameName, gamePath, seed, top, me } = data;
  const countdown = formatCountdown(data.endsAt);

  const handlePlay = () => {
    router.push(`/games${gamePath}?tournament=1&seed=${seed}`);
  };

  return (
    <div
      className="rounded-2xl border border-(--border) bg-(--surface) p-4 flex flex-col gap-3"
      style={{ animation: "dots-pop-in 0.35s ease-out both" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <p
            className="text-xs font-black uppercase tracking-widest"
            style={{ color: "var(--muted)" }}
          >
            Torneo semanal
          </p>
          <h2
            className="font-display text-lg font-extrabold"
            style={{ color: "var(--foreground)" }}
          >
            {gameName}
          </h2>
        </div>
        <div className="text-2xl select-none">🏆</div>
      </div>

      {/* Countdown */}
      {countdown && (
        <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
          termina en{" "}
          <span style={{ color: "var(--accent)" }}>{countdown}</span>
        </p>
      )}

      {/* Top 10 leaderboard */}
      {top.length > 0 && (
        <ol className="flex flex-col gap-1">
          {top.slice(0, 10).map((entry, i) => {
            const medal =
              i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
            return (
              <li
                key={i}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span
                  className="font-semibold truncate"
                  style={{ color: "var(--foreground)" }}
                >
                  {medal ? (
                    <span className="mr-1">{medal}</span>
                  ) : (
                    <span
                      className="mr-1 inline-block w-4 text-center text-xs font-bold"
                      style={{ color: "var(--muted)" }}
                    >
                      {i + 1}
                    </span>
                  )}
                  {entry.name}
                </span>
                <span
                  className="font-mono text-xs font-bold tabular-nums shrink-0"
                  style={{ color: "var(--muted)" }}
                >
                  {entry.score.toLocaleString()}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {top.length === 0 && (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Sé el primero en jugar este torneo.
        </p>
      )}

      {/* My position */}
      {me && (
        <p
          className="text-xs font-semibold rounded-xl px-3 py-1.5 text-center"
          style={{
            background: "color-mix(in srgb, var(--accent) 10%, transparent)",
            color: "var(--accent)",
          }}
        >
          Tu puesto: #{me.rank} · mejor: {me.best.toLocaleString()}
        </p>
      )}

      {/* CTA */}
      <button
        onClick={handlePlay}
        className="dots-pressable w-full rounded-2xl py-2.5 text-sm font-bold"
        style={{
          background: "var(--accent)",
          color: "var(--accent-foreground)",
        }}
      >
        Jugar torneo
      </button>
    </div>
  );
}
