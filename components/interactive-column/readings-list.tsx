import React, { useEffect, useState } from "react";
import Doty from "../ui/doty/doty";
//import { getEnabledReadingsService } from "../../../services/reading.service";
import Image from "next/image";
const Lock = "/images/Lock_icon.png";

type Reading = {
  id: number;
  title: string;
  unlocked: boolean;
  unlock_left?: number | string;
};

export default function ReadingsList() {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [hover, setHover] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 768);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    const fetch = async () => {
      try {
        const raw =
          typeof window !== "undefined" ? localStorage.getItem("user") : null;
        const user = raw ? JSON.parse(raw) : null;
        //const response = await getEnabledReadingsService(user);
        /* if (Array.isArray(response) && response.length > 0) setReadings(response as Reading[]);*/
      } catch {
        // ignore
      }
    };
    fetch();
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
        <Doty pose="17" size={isMobile ? "tiny" : "mini"} />
        <h3 className={`${isMobile ? "text-2xl" : "text-lg"} font-semibold text-foreground`}>
          Let&apos;s read!
        </h3>
      </div>

      <div className="relative w-full flex flex-col gap-3">
        {readings.map((item) => (
          <button
            key={item.id}
            onMouseEnter={() => setHover(item.id)}
            onMouseLeave={() => setHover(null)}
            onClick={() => item.unlocked && window.location.replace(`/readings/${item.id}`)}
            className={`w-full flex items-center gap-4 p-4 rounded-xl cursor-pointer transform transition-all duration-200 ${hover === item.id ? "scale-105" : "scale-100"}`}
            style={{
              background: hover === item.id
                ? "rgba(255,255,255,0.18)"
                : "rgba(255,255,255,0.09)",
              border: "1px solid rgba(255,255,255,0.18)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
          >
            {!item.unlocked && (
              <div className="flex flex-col items-center justify-center">
                <div className="w-8 h-8 relative">
                  <Image src={Lock} alt="Locked" fill className="object-contain" />
                </div>
                <div className="text-xs text-(--muted)">{item.unlock_left}</div>
              </div>
            )}
            <div className={`${isMobile ? "text-xl" : "text-base"} font-medium text-foreground`}>
              {item.title}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
