"use client";

import React, { useState } from "react";
import Doty from "../ui/doty/doty";
import Image from "next/image";
//import { getGamesService } from "../../../services/games.service";
const Bomb = "/images/DotBombs/bomb.png";
const Baloon = "/images/PopIt/balloon.png";

type GameItem = {
  id: number;
  name: string;
  path: string;
};

export default function GamesList() {
  const [games] = useState<GameItem[]>([]);
  const [hover, setHover] = useState<number | null>(null);

  // data fetch (wired when service is ready)
  // useEffect(() => { ... }, []);

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
        {games.map((item) => (
          <button
            key={item.id}
            onMouseEnter={() => setHover(item.id)}
            onMouseLeave={() => setHover(null)}
            onClick={() => window.location.replace(`/games${item.path}`)}
            className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-200 active:scale-[.98] cursor-pointer"
            style={{
              background: hover === item.id ? "rgba(212,0,126,0.10)" : "var(--background)",
              border: hover === item.id
                ? "1.5px solid rgba(212,0,126,0.35)"
                : "1.5px solid var(--border)",
            }}
          >
            <div className="shrink-0">
              {item.path === "/dont-pop" && (
                <div className="w-14 h-14 relative">
                  <Image src={Baloon} alt="balloon" fill className="object-contain" />
                </div>
              )}
              {item.path === "/dot-bombs" && (
                <div className="w-14 h-14 relative">
                  <Image src={Bomb} alt="bomb" fill className="object-contain" />
                </div>
              )}
            </div>
            <span className="text-base font-semibold text-(--foreground)">
              {item.name}
            </span>
          </button>
        ))}

        {/* Empty state */}
        {games.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-8 opacity-50">
            <Doty pose="01" size="small" />
            <p className="text-sm text-(--muted) text-center">Games coming soon!</p>
          </div>
        )}
      </div>
    </div>
  );
}
