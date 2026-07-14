"use client";

import React, { useEffect, useState } from "react";
import Doty from "../ui/doty/doty";
import {
  getLeaderboardService,
  type LeaderboardEntry,
  type LeaderboardPeriod,
} from "../../services/engagement.service";

const MEDALS = ["🥇", "🥈", "🥉"];

/** Kid privacy: first name + last-name initial only (e.g. "Sofia G.") */
const displayName = (entry: LeaderboardEntry) => {
  const first = (entry.name ?? "").trim().split(/\s+/)[0] || "?";
  const initial = (entry.last_name ?? "").trim().charAt(0);
  return initial ? `${first} ${initial.toUpperCase()}.` : first;
};

const PERIOD_TABS: { key: LeaderboardPeriod; label: string }[] = [
  { key: "week", label: "This week" },
  { key: "all", label: "All time" },
];

export default function TopStudents() {
  const [period, setPeriod] = useState<LeaderboardPeriod>("week");
  // keep the fetched rows tagged with their period so switching tabs
  // shows a spinner instead of the previous tab's list
  const [loaded, setLoaded] = useState<{
    period: LeaderboardPeriod;
    rows: LeaderboardEntry[];
  } | null>(null);

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

  return (
    <div className="w-full h-full overflow-auto flex flex-col gap-4 p-5">
      {/* Header */}
      <div className="flex items-center gap-2 shrink-0">
        <Doty pose="17" size="mini" />
        <span className="text-xs font-bold uppercase tracking-widest text-(--muted)">
          Top students
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
        {ranking.map((item) => (
          <div
            key={`${item.rank}-${item.name}`}
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl transition-all duration-200"
            style={{
              background: "var(--background)",
              border: "1.5px solid var(--border)",
            }}
          >
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
        ))}

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
              Rankings coming soon!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
