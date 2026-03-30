"use client";

import React, { useEffect, useState } from "react";
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
  const [games, setGames] = useState<GameItem[]>([]);
  const [hover, setHover] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 768);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    const getGames = async () => {
      /*const response = await getGamesService();
      if (Array.isArray(response) && response.length > 0) {
        setGames(response as GameItem[]);
      }
        */
    };
    getGames();
  }, []);

  return (
    <div
      className="w-full h-full overflow-auto flex flex-col items-center gap-4 p-6 relative"
      style={{
        background: "linear-gradient(155deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.09) 100%)",
      }}
    >
      {/* Top sheen */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-1/3"
        style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.12) 0%, transparent 100%)" }}
      />
      <div className="relative flex items-center gap-2">
        <Doty pose="12" size={isMobile ? "tiny" : "mini"} />
        <h3 className={`${isMobile ? "text-2xl" : "text-lg"} font-semibold text-foreground`}>
          Let&apos;s play!
        </h3>
      </div>

      <div className="relative w-full flex flex-col gap-3">
        {games.map((item) => (
          <button
            key={item.id}
            onMouseEnter={() => setHover(item.id)}
            onMouseLeave={() => setHover(null)}
            onClick={() => window.location.replace(`/games${item.path}`)}
            className={`flex items-center justify-center gap-3 w-full p-4 rounded-xl cursor-pointer transform transition-all duration-200 ${hover === item.id ? "scale-105" : "scale-100"}`}
            style={{
              background: hover === item.id
                ? "rgba(255,255,255,0.18)"
                : "rgba(255,255,255,0.09)",
              border: "1px solid rgba(255,255,255,0.18)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
          >
            <div className="shrink-0">
              {item.path === "/dont-pop" && (
                <div className={`${isMobile ? "w-24 h-24" : "w-16 h-16"} relative`}>
                  <Image src={Baloon} alt="balloon" fill className="object-contain" />
                </div>
              )}
              {item.path === "/dot-bombs" && (
                <div className={`${isMobile ? "w-28 h-28 -translate-x-2" : "w-20 h-20 -translate-x-2"} relative`}>
                  <Image src={Bomb} alt="bomb" fill className="object-contain" />
                </div>
              )}
            </div>
            <div className={`${isMobile ? "text-xl" : "text-base"} font-medium text-foreground`}>
              {item.name}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
