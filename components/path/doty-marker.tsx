"use client";

import React from "react";
import Doty from "@/components/ui/doty/doty";

interface DotyMarkerProps {
  side?: "left" | "right";
}

/** Small Doty anchored beside the current node, cheering the learner on. */
export default function DotyMarker({ side = "right" }: DotyMarkerProps) {
  const anchor: React.CSSProperties =
    side === "right" ? { left: "100%" } : { right: "100%" };

  return (
    <div
      aria-hidden
      className="absolute flex flex-col items-center gap-0.5 pointer-events-none select-none"
      style={{
        top: -6,
        width: 96,
        zIndex: 20,
        animation: "dots-float 3s ease-in-out infinite",
        ...anchor,
      }}
    >
      <div
        className="rounded-2xl px-2.5 py-1 text-[11px] font-black whitespace-nowrap"
        style={{
          background: "var(--surface)",
          border: "2px solid var(--border)",
          color: "var(--foreground)",
          boxShadow: "0 3px 10px rgba(0,0,0,0.10)",
        }}
      >
        ¡Sigue aquí!
      </div>
      <Doty pose="17" size="mini" />
    </div>
  );
}
