"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Doty from "../ui/doty/doty";
import { getGamesService, type Game } from "@/services/games.service";

const Bomb = "/images/DotBombs/bomb.png";
const Balloon = "/images/PopIt/balloon.png";

// Per-path visuals so each game keeps a recognizable identity in the menu.
const gameVisual = (path: string): { img?: string; emoji?: string } => {
  if (path === "/dont-pop") return { img: Balloon };
  if (path === "/dot-bombs") return { img: Bomb };
  if (path === "/flashcards") return { emoji: "🎴" };
  if (path === "/dotaxi") return { emoji: "🚕" };
  return { emoji: "🎮" };
};

export default function GamesList() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    getGamesService()
      .then((data) => {
        if (active) setGames(data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="w-full h-full overflow-auto flex flex-col gap-4 p-5">
      {/* Header */}
      <div className="flex items-center gap-2 shrink-0">
        <Doty pose="12" size="mini" />
        <span className="text-xs font-bold uppercase tracking-widest text-(--muted)">
          Let&apos;s play!
        </span>
      </div>

      {/* List */}
      <div className="flex flex-col gap-3">
        {games.map((item) => {
          const visual = gameVisual(item.path);
          const locked = !item.unlocked;
          return (
            <button
              key={item.id}
              disabled={locked}
              onMouseEnter={() => setHover(item.id)}
              onMouseLeave={() => setHover(null)}
              onClick={() =>
                !locked && window.location.assign(`/games${item.path}`)
              }
              className="dots-pressable w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-left [--press-color:var(--border)] disabled:opacity-55 disabled:cursor-not-allowed"
              style={{
                background:
                  hover === item.id && !locked
                    ? "color-mix(in srgb, var(--accent) 10%, transparent)"
                    : "var(--background)",
                border:
                  hover === item.id && !locked
                    ? "2px solid color-mix(in srgb, var(--accent) 35%, transparent)"
                    : "2px solid var(--border)",
              }}
            >
              {/* Icon */}
              <div className="shrink-0 w-12 h-12 relative flex items-center justify-center">
                {visual.img ? (
                  <Image
                    src={visual.img}
                    alt=""
                    fill
                    className="object-contain"
                    style={{ filter: locked ? "grayscale(1)" : "none" }}
                  />
                ) : (
                  <span
                    className="text-3xl"
                    style={{ filter: locked ? "grayscale(1)" : "none" }}
                  >
                    {visual.emoji}
                  </span>
                )}
              </div>

              {/* Label */}
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-base font-extrabold text-foreground truncate">
                  {item.name}
                </span>
                {locked ? (
                  <span className="text-[11px] font-bold text-(--muted)">
                    🔒 {item.levelsLeft} more level
                    {item.levelsLeft === 1 ? "" : "s"} to unlock
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-(--accent)">
                    Play now →
                  </span>
                )}
              </div>
            </button>
          );
        })}

        {/* Loading / empty state */}
        {!loading && games.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-8 opacity-60">
            <Doty pose="01" size="small" />
            <p className="text-sm text-(--muted) text-center">
              Games coming soon!
            </p>
          </div>
        )}
        {loading && (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="h-7 w-7 animate-spin rounded-full border-3 border-(--border) border-t-(--accent)" />
          </div>
        )}
      </div>
    </div>
  );
}
