/**
 * Geometría del nivel del Camino, en reposo y expandido (spec
 * docs/superpowers/specs/2026-09-30-nivel-que-se-expande-design.md).
 *
 * Coordenadas del SLOT del nodo: una caja de 150 px que path-section pone en la
 * pista a `calc(X% - 75px)`. Las del expandido son longitudes lineales
 * `px + cqw`: la pista es el contenedor (`container-type: inline-size`), así
 * que `1cqw` es el 1 % de su ancho y el CSS lo resuelve solo, sin que JS mida.
 *
 * Dos variantes, que elige una container query en globals.css:
 * - `narrow` (pista < 520 px: móvil, y escritorio estrecho con el panel al
 *   lado): la burbuja ocupa la pista entera.
 * - `wide` (pista ≥ 520 px): 440 px anclada a su lado del zigzag.
 *
 * Lógica pura y sin imports: `node --test` la ejecuta tal cual.
 */

export type NodeSide = "left" | "center" | "right";
export type BubbleMode = "narrow" | "wide";
/** Longitud lineal: `px` píxeles más `cqw` centésimas del ancho de la pista. */
export type Lin = { px: number; cqw: number };

// ── Reposo ───────────────────────────────────────────────────────────────
export const SLOT_W = 150;
/** El arte (128) flota en una caja de 136: 8 px de aire para el resplandor. */
export const ART_BOX = 136;
export const MILESTONES_W = 104;
export const MILESTONE_DOT = 14;
export const LABEL_H = 30;
export const MS_TOP = ART_BOX + 4; // 140
export const LABEL_TOP = MS_TOP + MILESTONE_DOT + 4; // 158
/** Alto de fila. Expandir NO lo cambia: por eso el camino no se mueve. */
export const NODE_ROW_H = LABEL_TOP + LABEL_H; // 188
const ART_INSET = (SLOT_W - ART_BOX) / 2; // 7

// ── Expandido ────────────────────────────────────────────────────────────
/** La burbuja desborda 4 px por arriba del slot y llega hasta su base. */
export const BUBBLE_TOP = -4;
export const BUBBLE_H = NODE_ROW_H - BUBBLE_TOP; // 192
/** Cuánto baja la imagen para quedar centrada en la burbuja. */
export const ART_OPEN_DY = BUBBLE_TOP + (BUBBLE_H - ART_BOX) / 2; // 24
/** Columna, en coords de la burbuja: tipo, título de dos líneas, hitos, botón. */
export const COL = {
  top: 24,
  typeH: 14,
  titleGap: 2,
  titleH: 38,
  msGap: 10,
  msH: 28,
  ctaGap: 12,
  ctaH: 42,
} as const;
/** Donde caen los hitos al expandir, en coords del slot. */
export const MS_OPEN_TOP = BUBBLE_TOP + COL.top + COL.typeH + COL.titleGap + COL.titleH + COL.msGap; // 84
/** Aire entre el borde de la burbuja y la imagen. */
const PAD = 12;
/** La columna empieza tras la imagen y deja 16 px al otro borde. */
const COL_FROM_ART = PAD + ART_BOX + 12; // 160
const COL_END = 16;
export const WIDE_W = 440;
/** Umbral de la container query de globals.css (hay un test que los ata). */
export const WIDE_MIN_TRACK = 520;
/** Doty asomado con su globo al lado. */
export const DOTY_PEEK_W = 200;
/** Doty mini mide 80: con la base a 18 px, sus 22 px de abajo quedan tras la burbuja. */
export const DOTY_PEEK_TOP = BUBBLE_TOP + 22 - 80; // -62
/** Lo que la fila del nivel actual reserva arriba para que Doty asome sin tocar al anterior. */
export const DOTY_ROOM = 48;

/** Posición horizontal del slot en la pista, en % (el zigzag de path-section). */
export const SIDE_X: Record<NodeSide, number> = { left: 15, center: 50, right: 85 };

export function sideOf(xPct: number): NodeSide {
  return xPct < 35 ? "left" : xPct > 65 ? "right" : "center";
}

export type BubbleGeometry = {
  bubbleLeft: Lin;
  bubbleWidth: Lin;
  /** `translate` horizontal de la imagen, desde su sitio en reposo. */
  artX: Lin;
  msLeft: Lin;
  msWidth: Lin;
  /** Borde izquierdo de la columna, en coords de la burbuja. */
  colLeft: number;
  colWidth: Lin;
  dotyLeft: Lin;
  artOnRight: boolean;
};

const lin = (px: number, cqw = 0): Lin => ({ px, cqw });
const add = (a: Lin, b: Lin): Lin => ({ px: a.px + b.px, cqw: a.cqw + b.cqw });

export function bubbleGeometry(side: NodeSide, mode: BubbleMode): BubbleGeometry {
  const artOnRight = side === "right";
  let bubbleLeft: Lin;
  let bubbleWidth: Lin;
  if (mode === "narrow") {
    // La pista entera: su borde izquierdo está a -(X% - 75px) del slot.
    bubbleLeft = lin(SLOT_W / 2, -SIDE_X[side]);
    bubbleWidth = lin(0, 100);
  } else {
    bubbleWidth = lin(WIDE_W);
    bubbleLeft =
      side === "left" ? lin(0) : side === "right" ? lin(SLOT_W - WIDE_W) : lin(SLOT_W / 2 - WIDE_W / 2);
  }
  const bubbleRight = add(bubbleLeft, bubbleWidth);
  const artLeft = artOnRight ? add(bubbleRight, lin(-PAD - ART_BOX)) : add(bubbleLeft, lin(PAD));
  const colLeft = artOnRight ? COL_END : COL_FROM_ART;
  const colWidth = add(bubbleWidth, lin(-(COL_FROM_ART + COL_END)));
  return {
    bubbleLeft,
    bubbleWidth,
    artX: add(artLeft, lin(-ART_INSET)),
    msLeft: add(bubbleLeft, lin(colLeft)),
    msWidth: colWidth,
    colLeft,
    colWidth,
    // En la punta de la columna, lejos de la imagen.
    dotyLeft: artOnRight
      ? add(bubbleLeft, lin(COL_END))
      : add(bubbleRight, lin(-COL_END - DOTY_PEEK_W)),
    artOnRight,
  };
}

/** Valor en px de una `Lin` para una pista de `trackW` px. */
export function evalLin(l: Lin, trackW: number): number {
  return l.px + (l.cqw * trackW) / 100;
}

/** `80px`, `100cqw` o `calc(80px - 15cqw)`. */
export function toCss(l: Lin): string {
  if (l.cqw === 0) return `${l.px}px`;
  if (l.px === 0) return `${l.cqw}cqw`;
  return `calc(${l.px}px ${l.cqw < 0 ? "-" : "+"} ${Math.abs(l.cqw)}cqw)`;
}

/** Variables CSS que el slot lleva en `style`; globals.css elige narrow o wide. */
export function bubbleVars(side: NodeSide): Record<string, string> {
  const vars: Record<string, string> = {
    "--nb-slot-w": `${SLOT_W}px`,
    "--nb-ms-left": `${(SLOT_W - MILESTONES_W) / 2}px`,
    "--nb-ms-top": `${MS_TOP}px`,
    "--nb-ms-w": `${MILESTONES_W}px`,
    "--nb-ms-top-open": `${MS_OPEN_TOP}px`,
    "--nb-art-dy": `${ART_OPEN_DY}px`,
    "--nb-cl": `${bubbleGeometry(side, "narrow").colLeft}px`,
  };
  for (const [mode, s] of [["narrow", "n"], ["wide", "w"]] as const) {
    const g = bubbleGeometry(side, mode);
    vars[`--nb-bl-${s}`] = toCss(g.bubbleLeft);
    vars[`--nb-bw-${s}`] = toCss(g.bubbleWidth);
    vars[`--nb-ax-${s}`] = toCss(g.artX);
    vars[`--nb-ml-${s}`] = toCss(g.msLeft);
    vars[`--nb-mw-${s}`] = toCss(g.msWidth);
    vars[`--nb-cw-${s}`] = toCss(g.colWidth);
    vars[`--nb-dl-${s}`] = toCss(g.dotyLeft);
  }
  return vars;
}
