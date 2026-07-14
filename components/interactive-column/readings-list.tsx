"use client";

import React, { useEffect, useState } from "react";
import Doty from "../ui/doty/doty";
import Image from "next/image";
import {
  getReadingsService,
  type ReadingSummary,
} from "../../services/engagement.service";
const Lock = "/images/Lock_icon.png";

export default function ReadingsList() {
  const [readings, setReadings] = useState<ReadingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    getReadingsService()
      .then((data) => {
        if (active) setReadings(data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="w-full h-full flex flex-col gap-3 p-5 overflow-auto">
      {/* Header */}
      <div className="flex items-center gap-2 shrink-0">
        <Doty pose="17" size="mini" />
        <span className="text-xs font-bold uppercase tracking-widest text-(--muted)">Let&apos;s read!</span>
      </div>

      <div className="flex flex-col gap-2">
        {!loading && readings.length === 0 && (
          <p className="text-xs text-(--muted) text-center pt-6">No readings available yet.</p>
        )}
        {loading && (
          <div className="flex justify-center py-8">
            <div className="h-7 w-7 animate-spin rounded-full border-3 border-(--border) border-t-(--accent)" />
          </div>
        )}
        {readings.map((item) => (
          <button
            key={item.id}
            disabled={!item.unlocked}
            onMouseEnter={() => setHover(item.id)}
            onMouseLeave={() => setHover(null)}
            onClick={() => item.unlocked && window.location.assign(`/readings/${item.id}`)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all duration-200 active:scale-[.98] disabled:opacity-55 disabled:cursor-not-allowed"
            style={{
              background: hover === item.id && item.unlocked ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "var(--background)",
              border: hover === item.id && item.unlocked ? "1.5px solid color-mix(in srgb, var(--accent) 35%, transparent)" : "1.5px solid var(--border)",
            }}
          >
            {!item.unlocked && (
              <div className="w-5 h-5 relative shrink-0">
                <Image src={Lock} alt="Locked" fill className="object-contain" />
              </div>
            )}
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm font-semibold text-foreground truncate">{item.title}</span>
              {!item.unlocked ? (
                <span className="text-[10px] font-bold text-(--muted)">
                  🔒 Unlocks at level {item.unlock}
                </span>
              ) : item.completed ? (
                <span className="text-[10px] font-bold text-(--success)">✅ Completed</span>
              ) : (
                <span className="text-[10px] font-bold text-(--accent)">Read now →</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
