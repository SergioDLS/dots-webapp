"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getChallengesService,
  type Challenge,
  type ChallengesData,
} from "@/services/challenges.service";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Rival desde mi perspectiva (mine = yo soy quien retó). */
const rivalName = (c: Challenge) =>
  c.mine ? c.challengedName : c.challengerName;

/** Mi resultado en un reto resuelto: won / lost / tie. */
function myOutcome(c: Challenge): "won" | "lost" | "tie" {
  const myScore = c.mine ? c.challengerScore : c.challengedScore;
  const theirScore = c.mine ? c.challengedScore : c.challengerScore;
  if (myScore === theirScore) return "tie";
  return (myScore ?? 0) > (theirScore ?? 0) ? "won" : "lost";
}

const OUTCOME_UI = {
  won: { icon: "✅", label: "¡Ganaste!" },
  lost: { icon: "❌", label: "Perdiste" },
  tie: { icon: "🤝", label: "Empate" },
} as const;

// ── Component ─────────────────────────────────────────────────────────────────

export default function ChallengesPanel() {
  const router = useRouter();
  const [data, setData] = useState<ChallengesData | null>(null);

  useEffect(() => {
    let active = true;
    getChallengesService().then((d) => {
      if (active) setData(d);
    });
    return () => {
      active = false;
    };
  }, []);

  if (data === null) {
    return (
      <div
        className="rounded-2xl border border-(--border) bg-(--surface) p-4 animate-pulse"
        style={{ minHeight: "6rem" }}
      />
    );
  }

  const { incoming, outgoing, history } = data;
  const empty =
    incoming.length === 0 && outgoing.length === 0 && history.length === 0;

  const play = (c: Challenge) => {
    router.push(`/games${c.gamePath}?challenge=${c.id}&seed=${c.seed}`);
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
            Retos 1v1
          </p>
          <h2
            className="font-display text-lg font-extrabold"
            style={{ color: "var(--foreground)" }}
          >
            Duelo directo
          </h2>
        </div>
        <div className="text-2xl select-none">⚔️</div>
      </div>

      {/* Empty state */}
      {empty && (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Nadie te ha retado… todavía. Busca a tu rival en el ranking y toca
          la espada. 😏
        </p>
      )}

      {/* Incoming: me retaron, tengo que jugar */}
      {incoming.length > 0 && (
        <ul className="flex flex-col gap-2">
          {incoming.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-2 rounded-xl px-3 py-2"
              style={{
                background:
                  "color-mix(in srgb, var(--accent) 8%, transparent)",
              }}
            >
              <span
                className="text-sm font-semibold min-w-0 truncate"
                style={{ color: "var(--foreground)" }}
              >
                <span className="font-extrabold">{c.challengerName}</span> te
                retó a {c.gameName}
              </span>
              <button
                onClick={() => play(c)}
                className="dots-pressable shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold"
                style={{
                  background: "var(--accent)",
                  color: "var(--accent-foreground)",
                }}
              >
                Jugar
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Outgoing: los que envié */}
      {outgoing.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {outgoing.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span
                className="font-semibold min-w-0 truncate"
                style={{ color: "var(--muted)" }}
              >
                ⚔️ {c.gameName} — esperando a{" "}
                <span style={{ color: "var(--foreground)" }}>
                  {c.challengedName}
                </span>
              </span>
              {c.challengerScore === null && (
                <button
                  onClick={() => play(c)}
                  className="dots-pressable shrink-0 rounded-xl px-3 py-1 text-xs font-bold"
                  style={{
                    border: "1.5px solid var(--accent)",
                    color: "var(--accent)",
                  }}
                >
                  Jugar mi turno
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* History: resueltos */}
      {history.length > 0 && (
        <div className="flex flex-col gap-1">
          <p
            className="text-[11px] font-black uppercase tracking-widest"
            style={{ color: "var(--muted)" }}
          >
            Historial
          </p>
          <ul className="flex flex-col gap-1">
            {history.map((c) => {
              const outcome = OUTCOME_UI[myOutcome(c)];
              const myScore = c.mine ? c.challengerScore : c.challengedScore;
              const theirScore = c.mine
                ? c.challengedScore
                : c.challengerScore;
              return (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span
                    className="font-semibold min-w-0 truncate"
                    style={{ color: "var(--foreground)" }}
                  >
                    <span className="mr-1">{outcome.icon}</span>
                    {outcome.label} vs {rivalName(c)} · {c.gameName}
                  </span>
                  <span
                    className="font-mono text-xs font-bold tabular-nums shrink-0"
                    style={{ color: "var(--muted)" }}
                  >
                    {myScore ?? 0}–{theirScore ?? 0}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
