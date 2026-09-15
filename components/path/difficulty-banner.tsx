"use client";

import type React from "react";
import Doty from "@/components/ui/doty/doty";
import SegmentedBar from "./segmented-bar";
import DifficultyNavArrows from "./difficulty-nav";
import { narratorPose } from "./narrator-pose";
import {
  PREVIEW_LINE,
  countLessons,
  encouragement,
  panelTint,
  prettyDifficultyName,
  type DifficultyNav,
} from "@/lib/path-view";
import type { PathDifficulty } from "@/types/path.types";

interface Props {
  difficulty: PathDifficulty;
  index: number;
  total: number;
  accentHex: string;
  nav: DifficultyNav;
  onGo: (id: number) => void;
  preview?: boolean;
  /** En escritorio, el botón "Volver a mi nivel" vive dentro del panel. */
  children?: React.ReactNode;
}

/**
 * Banner de dificultad (spec §3.2, composición A): panel teñido, radio 28, sin
 * borde; Doty narrador de 158 px asomando por la esquina superior derecha;
 * kicker, título, línea de ánimo, barra segmentada y conteo de lecciones (los
 * checkpoints no cuentan). `difficulty.img` trae la pose del narrador cuando el
 * backend ya la asignó; si no, cae al narrador por posición.
 */
export default function DifficultyBanner({
  difficulty,
  index,
  total,
  accentHex,
  nav,
  onGo,
  preview = false,
  children,
}: Props) {
  const { done, total: lessons, pct } = countLessons(difficulty.sections);
  const pose = narratorPose(difficulty.img, index);
  const headingId = `path-difficulty-${difficulty.id}`;

  return (
    <section
      aria-labelledby={headingId}
      className="relative w-full"
      style={{ background: panelTint(accentHex), borderRadius: 28, padding: "18px 20px 18px 20px" }}
    >
      {/* Cabecera: deja libre la esquina del narrador (158 px desde top -38 → ocupa hasta 120 px del panel). */}
      <div style={{ paddingRight: 134, minHeight: 104 }}>
        <p
          className="text-[11px] font-black uppercase tracking-widest"
          style={{ color: `color-mix(in srgb, ${accentHex} 60%, var(--foreground))` }}
        >
          {preview ? "Vista previa · " : ""}Dificultad {index + 1} de {total}
          {difficulty.skipped ? " · Superada" : ""}
        </p>
        <h2 id={headingId} className="font-display text-2xl font-extrabold leading-tight text-foreground">
          {prettyDifficultyName(difficulty.name)}
        </h2>
        <p className="mt-1 text-[13px] font-bold text-(--muted)">
          {preview ? PREVIEW_LINE : encouragement(pct)}
        </p>
      </div>
      <SegmentedBar sections={difficulty.sections} accentHex={accentHex} className="mt-4" valueNow={pct} />
      <p className="mt-2 whitespace-nowrap text-xs font-bold tabular-nums text-(--muted)">
        <b className="text-base font-black" style={{ color: accentHex }}>{done}</b> de {lessons} lecciones · {pct} %
      </p>
      <div className="mt-3 flex justify-end">
        <DifficultyNavArrows nav={nav} onGo={onGo} accentHex={accentHex} />
      </div>
      {children && <div className="mt-4">{children}</div>}
      <div
        aria-hidden
        className="pointer-events-none absolute select-none"
        style={{ top: -38, right: -6, filter: preview ? "grayscale(1)" : "none", opacity: preview ? 0.5 : 1 }}
      >
        <Doty pose={pose} size="banner" animation={preview ? "none" : "bob"} />
      </div>
    </section>
  );
}
