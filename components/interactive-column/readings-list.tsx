import React, { useState } from "react";
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
  const [readings] = useState<Reading[]>([]);
  const [hover, setHover] = useState<number | null>(null);

  // data fetch (commented out — wired when service is ready)
  // useEffect(() => { ... }, []);

  return (
    <div className="w-full h-full flex flex-col gap-3 p-5 overflow-auto">
      {/* Header */}
      <div className="flex items-center gap-2 shrink-0">
        <Doty pose="17" size="mini" />
        <span className="text-xs font-bold uppercase tracking-widest text-(--muted)">Let&apos;s read!</span>
      </div>

      <div className="flex flex-col gap-2">
        {readings.length === 0 && (
          <p className="text-xs text-(--muted) text-center pt-6">No readings available yet.</p>
        )}
        {readings.map((item) => (
          <button
            key={item.id}
            onMouseEnter={() => setHover(item.id)}
            onMouseLeave={() => setHover(null)}
            onClick={() => item.unlocked && window.location.replace(`/readings/${item.id}`)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all duration-200 active:scale-[.98]"
            style={{
              background: hover === item.id ? "rgba(212,0,126,0.10)" : "var(--background)",
              border: hover === item.id ? "1.5px solid rgba(212,0,126,0.35)" : "1.5px solid var(--border)",
            }}
          >
            {!item.unlocked && (
              <div className="flex flex-col items-center justify-center shrink-0">
                <div className="w-5 h-5 relative">
                  <Image src={Lock} alt="Locked" fill className="object-contain" />
                </div>
                <span className="text-[9px] text-(--muted) font-bold">{item.unlock_left}</span>
              </div>
            )}
            <span className="text-sm font-semibold text-foreground truncate">{item.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
