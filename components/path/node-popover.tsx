"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { NODE_META } from "@/lib/path-node-meta";
import type { PathNode } from "@/types/path.types";

interface NodePopoverProps {
  node: PathNode;
  accentHex: string;
  align: "left" | "center" | "right";
  onClose: () => void;
}

/** Módulos con dominio por ítem (F3e). */
const MASTERY_TYPES = new Set([
  "letters",
  "numbers",
  "vocab",
  "pronunciation",
  "grammar",
]);

export default function NodePopover({
  node,
  accentHex,
  align,
  onClose,
}: NodePopoverProps) {
  const router = useRouter();
  const meta = NODE_META[node.type];
  const progress = Math.max(0, Math.min(100, Math.round(node.progress)));
  const mastery = MASTERY_TYPES.has(node.type)
    ? Math.max(0, Math.min(100, Math.round(node.mastery ?? 0)))
    : null;

  const cta = node.completed
    ? "Repasar"
    : progress > 0
      ? "Continuar"
      : "Empezar";

  const alignStyle: React.CSSProperties =
    align === "left"
      ? { left: 0 }
      : align === "right"
        ? { right: 0 }
        : { left: "50%", transform: "translateX(-50%)" };

  return (
    <div
      className="absolute p-3 flex flex-col gap-2"
      role="dialog"
      aria-label={node.title}
      onClick={(e) => e.stopPropagation()}
      style={{
        top: "calc(100% + 6px)",
        width: 212,
        zIndex: 50,
        background: "var(--surface)",
        border: `2px solid color-mix(in srgb, ${accentHex} 40%, var(--border))`,
        borderRadius: 18,
        boxShadow: "0 8px 24px rgba(0,0,0,0.16)",
        animation: "dots-pop-in 250ms cubic-bezier(.34,1.56,.64,1) both",
        ...alignStyle,
      }}
    >
      {/* Type badge + progress % */}
      <div className="flex items-center justify-between gap-2">
        <span
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider"
          style={{
            background: `color-mix(in srgb, ${accentHex} 16%, var(--surface))`,
            border: `1.5px solid color-mix(in srgb, ${accentHex} 45%, var(--surface))`,
            color: `color-mix(in srgb, ${accentHex} 55%, var(--foreground))`,
          }}
        >
          {meta.icon} {meta.label}
        </span>
        <span
          className="text-[10px] font-black tabular-nums"
          style={{ color: node.completed ? "var(--success)" : accentHex }}
        >
          {progress}%
        </span>
      </div>

      {/* Title */}
      <p className="font-display text-sm font-extrabold leading-tight text-foreground">
        {node.title}
      </p>

      {/* Progress bar */}
      <div
        className="w-full rounded-full overflow-hidden"
        style={{
          height: 6,
          background: `color-mix(in srgb, ${accentHex} 15%, transparent)`,
        }}
      >
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${progress}%`,
            background: node.completed ? "var(--success)" : accentHex,
          }}
        />
      </div>

      {/* Mastery (dos niveles): dominado = corona */}
      {mastery != null && (
        <p
          className="text-[10px] font-black tabular-nums"
          style={{
            color:
              mastery >= 100
                ? "var(--gold, #f59e0b)"
                : "var(--muted)",
          }}
        >
          👑 Dominado {mastery}%
        </p>
      )}

      {/* CTA */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
          router.push(meta.route(node));
        }}
        className="w-full rounded-xl py-2 text-xs font-black tracking-wide cursor-pointer active:scale-95 transition-transform duration-100"
        style={{
          background: accentHex,
          color: "#fff",
          boxShadow: `0 3px 0 color-mix(in srgb, ${accentHex} 70%, black)`,
        }}
      >
        ▶ {cta}
      </button>
    </div>
  );
}
