// app/(app)/games/dotaxi/perspective.ts
// Geometría de la cámara de Dotaxi. Sin React ni DOM: portable a RN.
//
// Cámara de coche bajo, a la OutRun: horizonte a media pantalla, calzada más
// ancha que la escena en el borde cercano y K_BOTTOM veces más estrecha en el
// horizonte. La calzada es un plano girado con `perspective(P) rotateX(θ)`
// anclado en el horizonte, y θ se DERIVA de esa relación cerca/lejos en vez
// de fijarse a mano: así el aspecto es el mismo en cualquier alto de escena.
//
// Solo rayas y bordillos viven sobre el plano. Todo lo que se mueve —taxi,
// farolas, obstáculos, destino— va en espacio de pantalla con project(): sobre
// el plano 3D las cosas se estiran sin control cerca de la cámara.

export const PERSPECTIVE = 260;
/** El horizonte, a esta fracción del alto de la escena. Mitad = mirar al frente. */
export const HORIZON_FRAC = 0.52;
/** Cuántas veces es más ancha la calzada en el borde cercano que en el horizonte. */
export const K_BOTTOM = 8;
/** Calzada en el borde cercano respecto al ancho de la escena: un 15 % se
 *  pierde por cada lado, los bordillos salen por las esquinas y abajo casi
 *  todo es asfalto (pedido de Sergio: que se vea espaciosa). */
export const ROAD_BOTTOM_FACTOR = 1.3;
/** Bordillo rojo-blanco a cada lado en el borde cercano, en px de pantalla. */
export const CURB_BOTTOM_PX = 14;
/** Acera pavimentada más allá del bordillo, en px de pantalla en el borde
 *  cercano: ahí van las farolas, con el pie entero dentro (poste a 51 px y
 *  base de ~45 px de semiancho); los árboles, en el césped de detrás. */
export const SIDEWALK_BOTTOM_PX = 100;
/** Cuántas veces la calzada (con aceras) mide el terreno. Tiene que cubrir la
 *  escena entera TAMBIÉN en el horizonte, donde la calzada mide 1/K_BOTTOM
 *  del ancho de la escena: con 3 el césped acababa a media pantalla y a los
 *  lados asomaba el cielo. */
export const GROUND_FACTOR = 7.5;
/** El plano se alarga estos px más allá del pie de la escena y ella lo recorta:
 *  si el alto cambia tras medirse (la barra del navegador móvil se esconde), el
 *  suelo no se corta antes del borde. */
export const DEPTH_OVERSHOOT_PX = 32;

export interface PlaneMetrics {
  sceneW: number;
  sceneH: number;
  /** y del horizonte en px desde arriba de la escena */
  horizonY: number;
  /** inclinación del plano, derivada de K_BOTTOM y del alto disponible */
  thetaDeg: number;
  /** escala proyectada en el pie del plano (= K_BOTTOM) */
  kBottom: number;
  /** alto del plano en unidades de plano: su pie proyecta a sceneH + overshoot */
  planeH: number;
  /** calzada, bordillo, acera y plano (acera+bordillo+calzada+bordillo+acera) en unidades de plano */
  roadW: number;
  curbW: number;
  sidewalkW: number;
  planeW: number;
  /** terreno completo en unidades de plano y el césped a cada lado */
  groundW: number;
  groundMargin: number;
  /** calzada en px de pantalla en el borde cercano, y su borde izquierdo (negativo: sobresale) */
  roadBottomW: number;
  roadLeftBottom: number;
}

const rad = (deg: number) => (deg * Math.PI) / 180;

export function planeMetrics(sceneW: number, sceneH: number): PlaneMetrics {
  const P = PERSPECTIVE;
  const K = K_BOTTOM;
  const horizonY = Math.round(sceneH * HORIZON_FRAC);
  const depth = Math.max(1, sceneH - horizonY) + DEPTH_OVERSHOOT_PX;
  // k(s) = P / (P − s·sinθ) y y(s) = s·cosθ·k(s). Imponer k(planeH) = K y
  // y(planeH) = depth da tanθ = P·(K−1)/depth y planeH = depth/(K·cosθ).
  const theta = Math.atan((P * (K - 1)) / depth);
  const planeH = depth / (K * Math.cos(theta));
  const roadBottomW = sceneW * ROAD_BOTTOM_FACTOR;
  const roadW = roadBottomW / K;
  const curbW = CURB_BOTTOM_PX / K;
  const sidewalkW = SIDEWALK_BOTTOM_PX / K;
  const planeW = roadW + 2 * curbW + 2 * sidewalkW;
  const groundW = planeW * GROUND_FACTOR;
  return {
    sceneW,
    sceneH,
    horizonY,
    thetaDeg: (theta * 180) / Math.PI,
    kBottom: K,
    planeH,
    roadW,
    curbW,
    sidewalkW,
    planeW,
    groundW,
    groundMargin: (groundW - planeW) / 2,
    roadBottomW,
    roadLeftBottom: (sceneW - roadBottomW) / 2,
  };
}

/** Escala y `y` de pantalla de un punto del plano a profundidad `s` (0 = horizonte). */
export function project(m: PlaneMetrics, s: number): { k: number; y: number } {
  const th = rad(m.thetaDeg);
  const k = PERSPECTIVE / (PERSPECTIVE - s * Math.sin(th));
  return { k, y: m.horizonY + s * Math.cos(th) * k };
}

/** Centro del carril `pct` (0-100 sobre la calzada) en px de pantalla, borde cercano. */
export function laneXBottom(m: PlaneMetrics, pct: number): number {
  return m.roadLeftBottom + (pct / 100) * m.roadBottomW;
}

/** Centro del carril `pct` visto a la escala relativa `r` (= k/kBottom, 1 en el
 *  borde cercano, →0 en el horizonte). Para lo que se coloca por escala y no
 *  por profundidad, como las palabras que flotan sobre la calzada. */
export function laneXAtScale(m: PlaneMetrics, pct: number, r: number): number {
  return m.sceneW / 2 + (pct / 100 - 0.5) * m.roadBottomW * r;
}

/** Centro del carril `pct` a profundidad `s`: converge hacia el punto de fuga. */
export function laneXAt(m: PlaneMetrics, pct: number, s: number): number {
  const { k } = project(m, s);
  return m.sceneW / 2 + (pct / 100 - 0.5) * m.roadBottomW * (k / m.kBottom);
}

/** Un punto del lateral (`side` −1 izquierda, +1 derecha) a `offsetBottomPx`
 *  del borde exterior del bordillo, medidos en el borde cercano, proyectado a
 *  profundidad `s`. La acera ocupa de 0 a SIDEWALK_BOTTOM_PX. */
export function edgeXAt(m: PlaneMetrics, side: -1 | 1, offsetBottomPx: number, s: number): number {
  const { k } = project(m, s);
  return m.sceneW / 2 + side * (m.roadBottomW / 2 + CURB_BOTTOM_PX + offsetBottomPx) * (k / m.kBottom);
}

/**
 * Algo que viaja por el suelo en espacio de pantalla: `p` es su avance, 0 en
 * el horizonte y 1 en el pie del plano (ya fuera de la escena). Pasado 1 sigue
 * deslizándose hacia abajo en línea recta hasta desaparecer del todo: no se
 * proyecta más allá del pie porque ahí la profundidad se acerca a la cámara
 * y la escala se dispara.
 */
export function travel(m: PlaneMetrics, p: number): { y: number; k: number; s: number } {
  const s = Math.min(1, Math.max(0, p)) * m.planeH;
  const { k, y } = project(m, s);
  const extra = Math.max(0, p - 1) * (m.sceneH * 1.2);
  return { y: y + extra, k, s };
}

/** Hasta qué avance vale la pena pintar algo que viaja: pasado esto ya salió. */
export const TRAVEL_END = 1.3;
