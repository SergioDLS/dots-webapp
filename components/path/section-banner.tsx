"use client";

import Doty from "@/components/ui/doty/doty";
import { clampPct, countLessons, sectionPose } from "@/lib/path-view";
import type { PathSection } from "@/types/path.types";

interface Props {
  section: PathSection;
  index: number;
  total: number;
  accentHex: string;
  /** Sección aún no alcanzada o vista previa: gris y sin animación. */
  muted?: boolean;
}

/** Sub-banner de sección (spec §3.2, solución 2): panel teñido del color de la sección, radio 22, Doty de 104 px. */
export default function SectionBanner({ section, index, total, accentHex, muted = false }: Props) {
  const { done, total: lessons } = countLessons([section]);
  const pct = section.skipped ? 100 : clampPct(section.progress);
  return (
    <header
      className="relative w-full"
      style={{
        background: `color-mix(in srgb, ${accentHex} 14%, var(--surface))`,
        borderRadius: 22,
        padding: "14px 120px 14px 16px",
        opacity: muted ? 0.6 : 1,
        filter: muted ? "grayscale(1)" : "none",
      }}
    >
      <p
        className="text-[11px] font-black uppercase tracking-widest"
        style={{ color: `color-mix(in srgb, ${accentHex} 60%, var(--foreground))` }}
      >
        Sección {index + 1} de {total}
        {section.skipped ? " · Superada" : ""}
      </p>
      <h3 className="truncate font-display text-lg font-extrabold leading-tight text-foreground">
        {section.name}
      </h3>
      <div className="mt-2 flex items-center gap-2">
        <div
          className="h-2 flex-1 overflow-hidden rounded-full"
          role="progressbar"
          aria-label={`Progreso de ${section.name}`}
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{ background: `color-mix(in srgb, ${accentHex} 18%, transparent)` }}
        >
          <div
            className="h-full rounded-full transition-[width] duration-700 ease-out"
            style={{ width: `${pct}%`, background: pct >= 100 ? "var(--success)" : accentHex }}
          />
        </div>
        <span className="shrink-0 text-xs font-extrabold tabular-nums text-(--muted)">
          {done} de {lessons} lecciones
        </span>
      </div>
      <div aria-hidden className="pointer-events-none absolute select-none" style={{ top: -22, right: -2 }}>
        <Doty pose={sectionPose(section.id)} size="section" animation={muted ? "none" : "bob"} />
      </div>
    </header>
  );
}
