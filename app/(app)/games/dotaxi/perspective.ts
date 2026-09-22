// app/(app)/games/dotaxi/perspective.ts
// Geometría del plano inclinado de Dotaxi. Sin React ni DOM: portable a RN.
//
// La calzada es un rectángulo girado con `perspective(P) rotateX(θ)` anclado en
// su borde superior (el horizonte). Un punto a profundidad `s` unidades de plano
// desde el horizonte queda a z = s·sinθ hacia la cámara y su escala proyectada
// es k = P / (P − s·sinθ): lo cercano crece, lo lejano encoge, y todo lo que se
// coloque SOBRE el plano (bache, destino) hereda la perspectiva sin cálculos.
// Lo que va fuera del plano (taxi, pórtico) se sitúa con estas funciones.

// Inclinación y distancia de cámara. Con 58° y 260 la calzada llegaba al
// horizonte con un tercio de su ancho y los carriles se sentían estrechos;
// con 54° y 320 el fondo conserva el 40 % y las señales del pórtico ganan
// sitio para la palabra.
export const THETA_DEG = 54;
export const PERSPECTIVE = 320;
/** El horizonte, a esta fracción del alto de la escena. */
export const HORIZON_FRAC = 0.34;
/** Acera visible a cada lado en el borde cercano, en px de pantalla. Fina a
 *  propósito: la calzada es el escenario y cada px suyo es carril. */
export const CURB_BOTTOM_PX = 22;

export interface PlaneMetrics {
  sceneW: number;
  sceneH: number;
  /** y del horizonte en px desde arriba de la escena */
  horizonY: number;
  /** ancho del plano (acera + calzada + acera) en unidades de plano */
  planeW: number;
  /** alto del plano en unidades de plano: su borde inferior proyecta justo al pie de la escena */
  planeH: number;
  /** calzada y acera en unidades de plano */
  roadW: number;
  curbW: number;
  /** escala proyectada en el borde cercano */
  kBottom: number;
  /** calzada en px de pantalla en el borde cercano */
  roadBottomW: number;
}

const rad = (deg: number) => (deg * Math.PI) / 180;

export function planeMetrics(sceneW: number, sceneH: number): PlaneMetrics {
  const th = rad(THETA_DEG);
  const P = PERSPECTIVE;
  const horizonY = Math.round(sceneH * HORIZON_FRAC);
  const depth = Math.max(0, sceneH - horizonY);
  // s cuya proyección vertical s·cosθ·k(s) vale exactamente `depth`
  const planeH = (depth * P) / (P * Math.cos(th) + depth * Math.sin(th));
  const kBottom = P / (P - planeH * Math.sin(th));
  const planeW = sceneW / kBottom;
  const curbW = CURB_BOTTOM_PX / kBottom;
  return {
    sceneW,
    sceneH,
    horizonY,
    planeW,
    planeH,
    roadW: Math.max(0, planeW - 2 * curbW),
    curbW,
    kBottom,
    roadBottomW: Math.max(0, sceneW - 2 * CURB_BOTTOM_PX),
  };
}

/** Escala y `y` de pantalla de un punto del plano a profundidad `s` (0 = horizonte). */
export function project(m: PlaneMetrics, s: number): { k: number; y: number } {
  const th = rad(THETA_DEG);
  const k = PERSPECTIVE / (PERSPECTIVE - s * Math.sin(th));
  return { k, y: m.horizonY + s * Math.cos(th) * k };
}

/** Centro del carril `pct` (0-100 sobre la calzada) en px de pantalla, borde cercano. */
export function laneXBottom(m: PlaneMetrics, pct: number): number {
  return CURB_BOTTOM_PX + (pct / 100) * m.roadBottomW;
}

/** x de un punto de la calzada en unidades de plano (para hijos del plano). */
export function lanePlaneX(m: PlaneMetrics, pct: number): number {
  return m.curbW + (pct / 100) * m.roadW;
}
