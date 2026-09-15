"use client";

import React from "react";
import PathSection from "./path-section";
import DifficultyBanner from "./difficulty-banner";
import UpcomingDivider from "./upcoming-divider";
import { DIFFICULTY_COLOR_NAMES, DIFFICULTY_COLOR_HEX } from "@/lib/difficulty-palette";
import { firstUpcomingSectionIndex, type DifficultyNav } from "@/lib/path-view";
import type { PathDifficulty as PathDifficultyType, PathPeer } from "@/types/path.types";

interface PathDifficultyProps {
  difficulty: PathDifficultyType;
  nav: DifficultyNav;
  accentHex: string;
  peersByNodeId: Record<number, PathPeer[]>;
  /** Dificultad bloqueada vista "por curiosidad": todo en gris, sin popovers ni marcador. */
  preview: boolean;
  onGo: (id: number) => void;
  /** El contenedor observa el banner para plegar la cabecera. */
  bannerRef: React.Ref<HTMLDivElement>;
  /** Cabecera plegada (móvil): va antes del banner para poder ser sticky dentro de esta vista. */
  header?: React.ReactNode;
  /** Botón "Volver a mi nivel" en escritorio: dentro del panel sticky. */
  bannerFooter?: React.ReactNode;
}

/** La rotación de la paleta por id de dificultad es la del dashboard legacy: no cambia. */
export function difficultyColors(id: number): string[] {
  const base = [...DIFFICULTY_COLOR_NAMES];
  const shift = (id ?? 0) % base.length;
  return [...base.slice(shift), ...base.slice(0, shift)].map(
    (name) => DIFFICULTY_COLOR_HEX[name] ?? DIFFICULTY_COLOR_HEX.pink,
  );
}

/**
 * Vista de UNA dificultad (spec §3.2). Móvil: cabecera plegada + banner +
 * secciones en columna. Escritorio (md+): grid de 300 px + pista, con el banner
 * completo en la columna izquierda en `position: sticky`.
 */
export default function PathDifficulty({
  difficulty,
  nav,
  accentHex,
  peersByNodeId,
  preview,
  onGo,
  bannerRef,
  header,
  bannerFooter,
}: PathDifficultyProps) {
  const colors = difficultyColors(difficulty.id);
  const { sections } = difficulty;
  const upcoming = preview ? -1 : firstUpcomingSectionIndex(sections);

  return (
    <div className="w-full md:grid md:grid-cols-[300px_minmax(0,1fr)] md:items-start md:gap-8">
      {header}

      <aside className="md:sticky md:top-[72px]">
        {/* Aire arriba para el narrador que asoma por encima del panel. */}
        <div ref={bannerRef} className="pt-9" style={{ filter: preview ? "grayscale(1)" : undefined }}>
          <DifficultyBanner
            difficulty={difficulty}
            index={nav.index}
            total={nav.total}
            accentHex={accentHex}
            nav={nav}
            onGo={onGo}
            preview={preview}
          >
            {bannerFooter}
          </DifficultyBanner>
        </div>
      </aside>

      {/* Aire en escritorio: el primer sub-banner queda a la altura del panel del aside
          (sticky 72 + 36 de aire) y su Doty, que asoma 22 px, no se mete bajo el HUD. */}
      <div className="mt-6 flex w-full flex-col items-center gap-10 md:mt-0 md:pt-12">
        {sections.length === 0 ? (
          <span className="text-(--muted)">No hay secciones disponibles.</span>
        ) : (
          sections.map((section, i) => (
            <React.Fragment key={section.id}>
              {i === upcoming && <UpcomingDivider sectionNumber={i + 1} />}
              <PathSection
                section={section}
                index={i}
                total={sections.length}
                accentHex={colors[i % colors.length]}
                peersByNodeId={peersByNodeId}
                preview={preview}
              />
            </React.Fragment>
          ))
        )}
      </div>
    </div>
  );
}
