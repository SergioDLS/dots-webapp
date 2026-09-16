import type { DotyAnimation, DotyPose } from "@/components/ui/doty/doty";

/**
 * El dorso del avatar (spec §6.4): tiempos del giro de entrada y pose por
 * gesto. Vive fuera de los componentes para poder probarse con `node --test`:
 * por eso SOLO admite `import type` (Node ejecuta este archivo sin bundler y
 * no resolvería el alias `@/`).
 */

/** Duración de una vuelta de cada animación, calcada de app/globals.css (doty-*). */
export const LOOP_MS: Record<DotyAnimation, number> = {
  none: 0,
  bob: 2200,
  cheer: 900,
  sad: 3000,
  wave: 1600,
};

/** Lo que tarda la carta en girar (transición de `transform`). */
export const FLIP_MS = 400;

/** Cuánto se ve el retrato antes del primer giro: que se vea que es tu avatar. */
export const FLOURISH_DELAY_MS = 600;

/** Lo que debería durar el gesto a la vista, redondeado a vueltas completas. */
const FLOURISH_TARGET_MS = 3000;

const GESTURES: readonly string[] = ["bob", "cheer", "sad", "wave"];

/**
 * La animación que trae un ítem del inventario o la tienda en `meta.animation`,
 * o null si no es un gesto que Doty sepa hacer. `"none"` no cuenta como gesto.
 */
export function gestureAnimation(
  item: { meta: Record<string, unknown> | null } | null | undefined,
): DotyAnimation | null {
  const raw = item?.meta?.animation;
  return typeof raw === "string" && GESTURES.includes(raw) ? (raw as DotyAnimation) : null;
}

/**
 * La pose que hace legible el gesto: saludar con la mano ya en el aire y
 * festejar con los dos brazos arriba. `feliz` para lo que no tenga pose propia.
 */
export function gesturePose(animation: DotyAnimation): DotyPose {
  if (animation === "wave") return "saludando";
  if (animation === "cheer") return "emocionado";
  return "feliz";
}

/**
 * Vueltas completas que más se acercan a FLOURISH_TARGET_MS, nunca menos de
 * dos: una sola vuelta de 1.6 s no da tiempo a reconocer el gesto.
 */
export function flourishLoops(animation: DotyAnimation): number {
  const loop = LOOP_MS[animation];
  if (loop === 0) return 0;
  return Math.max(2, Math.round(FLOURISH_TARGET_MS / loop));
}

export function flourishMs(animation: DotyAnimation): number {
  return flourishLoops(animation) * LOOP_MS[animation];
}

export interface FlourishTimeline {
  /** ms desde que hay datos hasta que la carta empieza a girar al dorso. */
  flipAt: number;
  /** ms hasta que empieza a volver al retrato: giro + vueltas completas del gesto. */
  flipBackAt: number;
}

/** null sin gesto: el disco no gira nunca si no hay nada que mostrar. */
export function flourishTimeline(animation: DotyAnimation | null): FlourishTimeline | null {
  if (animation === null || LOOP_MS[animation] === 0) return null;
  const flipAt = FLOURISH_DELAY_MS;
  return { flipAt, flipBackAt: flipAt + FLIP_MS + flourishMs(animation) };
}

/**
 * Con `prefers-reduced-motion` no hay giro de entrada: es accesibilidad, no un
 * extra (mismo criterio que la animación de entrada a la app). El tap sigue
 * cambiando de cara porque lo pide el usuario.
 */
export function shouldFlourish(animation: DotyAnimation | null, reducedMotion: boolean): boolean {
  return animation !== null && LOOP_MS[animation] > 0 && !reducedMotion;
}
