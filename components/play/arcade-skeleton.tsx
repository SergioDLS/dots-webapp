"use client";

import { ARCADE_GRID_CLASS } from "./arcade-grid";
import {
  HERO_ART_BOX,
  HERO_EYEBROW_H,
  HERO_H,
  HERO_NAME_H,
  HERO_STATUS_H,
} from "./daily-hero";
import { TILE_ART_BOX, TILE_H, TILE_LABEL_H } from "./game-tile";

/**
 * Esqueleto de carga. Calca la retícula real usando las MISMAS constantes que
 * los tiles y el mismo `grid`, no medidas parecidas: el esqueleto anterior
 * dibujaba tarjetas de otra forma y la pantalla saltaba al llegar los datos
 * (spec §4: "el skeleton replica exactamente la retícula real").
 */

const PULSE = "animate-pulse rounded-full bg-(--surface-2)";

/** Diez arcade: los doce juegos menos los dos diarios, que son héroes. */
const ARCADE_SLOTS = 10;

export default function ArcadeSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <ul className="grid grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <li key={i} className="flex flex-col items-center gap-1.5" style={{ height: HERO_H }}>
            <span className={PULSE} style={{ height: HERO_ART_BOX, width: HERO_ART_BOX }} />
            <span className={`${PULSE} w-16`} style={{ height: HERO_EYEBROW_H }} />
            <span className={`${PULSE} w-24`} style={{ height: HERO_NAME_H }} />
            <span className={`${PULSE} w-20`} style={{ height: HERO_STATUS_H }} />
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-3">
        <span className={`${PULSE} w-20`} style={{ height: 14 }} />
        <ul className={ARCADE_GRID_CLASS}>
          {Array.from({ length: ARCADE_SLOTS }, (_, i) => (
            <li key={i} className="flex flex-col items-center gap-1.5" style={{ height: TILE_H }}>
              <span className={PULSE} style={{ height: TILE_ART_BOX, width: TILE_ART_BOX }} />
              <span className={`${PULSE} w-14`} style={{ height: TILE_LABEL_H / 2 }} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
