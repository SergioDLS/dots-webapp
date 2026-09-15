import { clampPct } from "@/lib/path-view";
import type { PathSection } from "@/types/path.types";

interface Props {
  sections: readonly PathSection[];
  accentHex: string;
  height?: number;
  gap?: number;
  className?: string;
}

/** Un segmento por sección: relleno = `section.progress`; las completadas o superadas, en --success. */
export default function SegmentedBar({ sections, accentHex, height = 8, gap = 4, className = "" }: Props) {
  const avg =
    sections.length === 0
      ? 0
      : Math.round(sections.reduce((a, s) => a + (s.skipped ? 100 : clampPct(s.progress)), 0) / sections.length);
  return (
    <div
      className={`flex w-full ${className}`}
      style={{ gap }}
      role="progressbar"
      aria-label="Progreso por sección"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={avg}
    >
      {sections.map((s) => {
        const pct = s.skipped ? 100 : clampPct(s.progress);
        return (
          <div
            key={s.id}
            className="flex-1 overflow-hidden rounded-full"
            style={{ height, background: `color-mix(in srgb, ${accentHex} 18%, transparent)` }}
          >
            <div
              className="h-full rounded-full transition-[width] duration-700 ease-out"
              style={{ width: `${pct}%`, background: pct >= 100 ? "var(--success)" : accentHex }}
            />
          </div>
        );
      })}
    </div>
  );
}
