"use client";

import type { CSSProperties } from "react";
import { Icon } from "@/components/ui/icon";
import { MILESTONE_DOT } from "@/lib/node-bubble";
import {
  MILESTONE_LABEL,
  milestonesLabel,
  type MilestoneLeg,
  type MilestoneTone,
} from "@/lib/node-milestones";

interface Props {
  legs: readonly MilestoneLeg[];
  accentHex: string;
  /** Expandido: se ven «Completado» y «Dominado» bajo cada hito. */
  labeled?: boolean;
  className?: string;
  style?: CSSProperties;
}

const SEG_H = 8;

/** El dorado del dominio es el mismo degradado que tenía el check de la esquina. */
const paint = (tone: MilestoneTone, accentHex: string): string =>
  tone === "success"
    ? "var(--success)"
    : tone === "gold"
      ? "linear-gradient(135deg, var(--gold), var(--gold-edge))"
      : accentHex;

/**
 * Barra de hitos de un nivel (spec 2026-09-30 §Hitos): un tramo por logro, con
 * su hito al final. El hito alcanzado lleva el check que antes iba en la
 * esquina de la imagen: hay un solo lugar que dice cuánto llevas.
 */
export default function NodeMilestones({ legs, accentHex, labeled = false, className = "", style }: Props) {
  return (
    <div
      role="group"
      aria-label={milestonesLabel(legs)}
      className={`flex items-center gap-[3px] ${className}`}
      style={{ height: MILESTONE_DOT, ...style }}
    >
      {legs.map((leg) => (
        <div key={leg.kind} className="relative flex min-w-0 flex-1 items-center gap-[3px]">
          <div
            className="flex-1 overflow-hidden rounded-full"
            style={{ height: SEG_H, background: `color-mix(in srgb, ${accentHex} 18%, transparent)` }}
          >
            <div
              className="h-full rounded-full transition-[width] duration-700 ease-out"
              style={{ width: `${leg.fill}%`, background: paint(leg.tone, accentHex) }}
            />
          </div>
          <span
            aria-hidden
            className="flex shrink-0 items-center justify-center rounded-full text-white"
            style={{
              width: MILESTONE_DOT,
              height: MILESTONE_DOT,
              background: leg.reached ? paint(leg.tone, accentHex) : "var(--surface)",
              border: leg.reached
                ? "2px solid var(--surface)"
                : `2px solid color-mix(in srgb, ${accentHex} 45%, transparent)`,
              boxShadow: leg.reached
                ? `0 1px 4px color-mix(in srgb, ${leg.tone === "gold" ? "var(--gold)" : "var(--success)"} 40%, transparent)`
                : "none",
            }}
          >
            {leg.reached && <Icon name="check" size={9} mono />}
          </span>
          <span
            aria-hidden
            className="pointer-events-none absolute right-0 whitespace-nowrap text-[10px] font-black leading-none text-(--muted) transition-opacity duration-200"
            style={{ top: MILESTONE_DOT + 4, opacity: labeled ? 1 : 0 }}
          >
            {MILESTONE_LABEL[leg.kind]}
          </span>
        </div>
      ))}
    </div>
  );
}
