"use client";

import React, {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import Doty from "../ui/doty/doty";
import {
  getLeaderboardService,
  type LeaderboardEntry,
  type LeaderboardPeriod,
} from "../../services/engagement.service";
import {
  CHALLENGE_GAMES,
  postChallengeService,
} from "../../services/challenges.service";

const MEDALS = ["🥇", "🥈", "🥉"];

/** Kid privacy: first name + last-name initial only (e.g. "Sofia G.") */
const displayName = (entry: LeaderboardEntry) => {
  const first = (entry.name ?? "").trim().split(/\s+/)[0] || "?";
  const initial = (entry.last_name ?? "").trim().charAt(0);
  return initial ? `${first} ${initial.toUpperCase()}.` : first;
};

const PERIOD_TABS: { key: LeaderboardPeriod; label: string }[] = [
  { key: "week", label: "Esta semana" },
  { key: "all", label: "Histórico" },
];

const emptySubscribe = () => () => {};

/** Feedback tras enviar (o fallar) un reto, anclado a la fila del retado. */
type ChallengeFeedback = { userId: number; msg: string; ok: boolean };

export default function TopStudents() {
  const [period, setPeriod] = useState<LeaderboardPeriod>("week");
  // keep the fetched rows tagged with their period so switching tabs
  // shows a spinner instead of the previous tab's list
  const [loaded, setLoaded] = useState<{
    period: LeaderboardPeriod;
    rows: LeaderboardEntry[];
  } | null>(null);

  // ── Reto 1v1: picker de juego por fila ──────────────────────────────
  // Two-pass rendering (mismo patrón que levels-header): el server no conoce
  // localStorage, así que mi id llega tras hidratar y recién ahí aparecen ⚔️.
  const hydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const myId = useMemo<number | null>(() => {
    if (!hydrated) return null;
    try {
      const raw = localStorage.getItem("user");
      const id = raw ? (JSON.parse(raw)?.id as unknown) : null;
      return typeof id === "number" ? id : null;
    } catch {
      return null;
    }
  }, [hydrated]);

  const [pickerFor, setPickerFor] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<ChallengeFeedback | null>(null);

  useEffect(() => {
    let active = true;
    getLeaderboardService(period).then((data) => {
      if (active) setLoaded({ period, rows: data.slice(0, 10) });
    });
    return () => {
      active = false;
    };
  }, [period]);

  const loading = loaded === null || loaded.period !== period;
  const ranking = loading ? [] : loaded.rows;

  const sendChallenge = (userId: number, gameKey: string) => {
    // Optimista: cerramos el picker y celebramos ya; si el backend rechaza
    // (p. ej. 3 pendientes), reemplazamos por el motivo real.
    setPickerFor(null);
    setFeedback({ userId, msg: "¡Reto enviado! ⚔️", ok: true });
    postChallengeService(userId, gameKey).catch((err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "No se pudo enviar el reto.";
      setFeedback({ userId, msg: String(msg), ok: false });
    });
  };

  return (
    <div className="w-full h-full overflow-auto flex flex-col gap-4 p-5">
      {/* Header */}
      <div className="flex items-center gap-2 shrink-0">
        <Doty pose="17" size="mini" />
        <span className="text-xs font-bold uppercase tracking-widest text-(--muted)">
          Ranking
        </span>
      </div>

      {/* Period tabs */}
      <div
        className="flex gap-1 rounded-full p-1 shrink-0"
        style={{ background: "var(--background)", border: "1.5px solid var(--border)" }}
        role="tablist"
        aria-label="Leaderboard period"
      >
        {PERIOD_TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={period === tab.key}
            onClick={() => setPeriod(tab.key)}
            className={`flex-1 rounded-full px-3 py-1.5 text-[11px] font-extrabold transition-all duration-200 ${
              period === tab.key
                ? "bg-(--accent) text-white shadow-sm"
                : "text-(--muted) hover:text-(--accent)"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex flex-col gap-2">
        {ranking.map((item) => {
          const canChallenge =
            typeof item.id === "number" && myId !== null && item.id !== myId;
          const pickerOpen = canChallenge && pickerFor === item.id;
          const rowFeedback =
            canChallenge && feedback?.userId === item.id ? feedback : null;
          return (
            <div
              key={`${item.rank}-${item.name}`}
              className="flex flex-col px-3.5 py-2.5 rounded-2xl transition-all duration-200"
              style={{
                background: "var(--background)",
                border: "1.5px solid var(--border)",
              }}
            >
              <div className="flex items-center gap-3">
                {/* Rank medal or number */}
                <div className="shrink-0 w-8 flex items-center justify-center">
                  {item.rank <= 3 ? (
                    <span className="text-2xl leading-none">
                      {MEDALS[item.rank - 1]}
                    </span>
                  ) : (
                    <span className="text-sm font-bold text-(--muted)">
                      {item.rank}
                    </span>
                  )}
                </div>

                {/* Name */}
                <span className="text-sm font-extrabold text-foreground truncate flex-1 min-w-0">
                  {displayName(item)}
                </span>

                {/* Retar 1v1 (nunca en mi propia fila) */}
                {canChallenge && (
                  <button
                    onClick={() =>
                      setPickerFor(pickerOpen ? null : (item.id as number))
                    }
                    aria-label={`Retar a ${displayName(item)}`}
                    aria-expanded={pickerOpen}
                    className="dots-pressable shrink-0 grid h-8 w-8 place-items-center rounded-xl text-base"
                    style={{ border: "1.5px solid var(--border)" }}
                  >
                    ⚔️
                  </button>
                )}

                {/* XP + streak */}
                <div className="flex flex-col items-end shrink-0">
                  <span className="text-xs font-black text-(--accent) tabular-nums">
                    {item.xp} XP
                  </span>
                  <span className="text-[11px] font-bold text-(--muted) tabular-nums">
                    🔥 {item.streak}
                  </span>
                </div>
              </div>

              {/* Picker inline: elegir juego del reto */}
              {pickerOpen && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {CHALLENGE_GAMES.map((game) => (
                    <button
                      key={game.key}
                      onClick={() =>
                        sendChallenge(item.id as number, game.key)
                      }
                      className="dots-pressable rounded-xl px-2.5 py-1.5 text-[11px] font-bold"
                      style={{
                        border: "1.5px solid var(--accent)",
                        color: "var(--accent)",
                      }}
                    >
                      {game.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Feedback del envío */}
              {rowFeedback && (
                <p
                  className="mt-1.5 text-[11px] font-bold"
                  style={{
                    color: rowFeedback.ok ? "var(--accent)" : "var(--muted)",
                  }}
                >
                  {rowFeedback.msg}
                </p>
              )}
            </div>
          );
        })}

        {/* Loading / empty state */}
        {loading && (
          <div className="flex justify-center py-8">
            <div className="h-7 w-7 animate-spin rounded-full border-3 border-(--border) border-t-(--accent)" />
          </div>
        )}
        {!loading && ranking.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-8 opacity-50">
            <Doty pose="17" size="small" />
            <p className="text-sm text-(--muted) text-center">
              ¡Ranking muy pronto!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
