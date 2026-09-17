"use client";

import Doty from "@/components/ui/doty/doty";
import SegmentedBar from "./segmented-bar";
import { DifficultyArrow } from "./difficulty-nav";
import { narratorPose } from "./narrator-pose";
import { countLessons, panelTint, prettyDifficultyName, type DifficultyNav } from "@/lib/path-view";
import type { PathDifficulty } from "@/types/path.types";

interface Props {
  difficulty: PathDifficulty;
  nav: DifficultyNav;
  accentHex: string;
  /** El banner salió del viewport. */
  visible: boolean;
  onGo: (id: number) => void;
}

/**
 * Cabecera plegada (spec §3.2, solución 1): barra pegajosa bajo el HUD con el
 * mismo tinte del banner. Es un contenedor sticky de altura 0 (no deja hueco
 * mientras el banner está a la vista) y la barra real va absoluta dentro; se
 * muestra con opacity/transform. Solo móvil: en escritorio el banner es sticky.
 */
export default function FoldedHeader({ difficulty, nav, accentHex, visible, onGo }: Props) {
  const { done, total } = countLessons(difficulty.sections);
  const pose = narratorPose(difficulty.img, nav.index);
  return (
    <div className="sticky z-20 h-0 md:hidden" style={{ top: 44 }} aria-hidden={!visible}>
      <div
        inert={!visible}
        /* Tapa una franja del viewport sin ser `header` ni `nav`: las pistas
           contextuales la descuentan por este atributo (ver `barras()` en
           hooks/use-tip-anchor.ts). */
        data-chrome-fijo
        className="absolute inset-x-0 top-0 flex items-center gap-2 rounded-2xl px-2.5 py-1.5 transition-[opacity,transform] duration-200"
        style={{
          background: panelTint(accentHex),
          boxShadow: "var(--shadow-card)",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(-8px)",
          pointerEvents: visible ? "auto" : "none",
        }}
      >
        <DifficultyArrow direction="prev" nav={nav} onGo={onGo} accentHex={accentHex} size={32} />
        <Doty pose={pose} size="chip" shadow={false} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[13px] font-extrabold leading-tight text-foreground">
            {prettyDifficultyName(difficulty.name)}
          </p>
          <p className="text-[11px] font-bold tabular-nums leading-tight text-(--muted)">
            {done} de {total} lecciones
          </p>
        </div>
        <div style={{ width: 88 }}>
          <SegmentedBar sections={difficulty.sections} accentHex={accentHex} height={6} gap={3} />
        </div>
        <DifficultyArrow direction="next" nav={nav} onGo={onGo} accentHex={accentHex} size={32} />
      </div>
    </div>
  );
}
