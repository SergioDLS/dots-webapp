import { gesturePose } from "./avatar-flip.ts";
import type { DotyAnimation, DotyPose } from "@/components/ui/doty/doty";

/**
 * Aviso "te pasó" (spec §6.5): decide si alguien te adelantó en el ranking
 * semanal desde la última comprobación, a quién nombrar y con qué cara.
 *
 * Lógica pura para poder probarse con `node --test`: por eso SOLO admite
 * `import type` para el alias `@/` — Node ejecuta este archivo sin bundler y
 * no lo resolvería. `./avatar-flip.ts` sí entra como valor porque es una ruta
 * relativa y ese archivo tampoco importa valores con alias; lleva la extensión
 * explícita porque el resolver de módulos de Node (a diferencia de un bundler)
 * no la completa sola. Por eso tsconfig.json tiene `allowImportingTsExtensions`.
 */

/** Lo que la tarjeta se queda a la vista. Da para leer dos líneas y ver un
 *  ciclo entero del gesto más largo, que dura 3 s. */
export const DURACION_MS = 6000;

/** Prefijo de la clave en localStorage. El que ya usaban los navegadores. */
const PREFIJO = "dots.rival.rank.";

/** Las animaciones que Doty sabe hacer; cualquier otra cae en la pose fija. */
const ANIMACIONES: readonly string[] = ["bob", "cheer", "sad", "wave"];

/** Cuando el ranking no trae nombre, la frase tiene que seguir funcionando. */
const SIN_NOMBRE = "Alguien";

/** Puesto y semana de la última comprobación, por usuario y por dispositivo. */
export interface SnapshotRival {
  rank: number | null;
  weekStart: string | null;
}

/** Un vecino del ranking, tal como llega de `GET /me/rival`. */
export interface VecinoRival {
  name: string;
  delta: number;
  gesture: string | null;
}

/** La respuesta del servidor, en lo que a esta decisión le importa. */
export interface EstadoRival {
  rank: number | null;
  weekStart: string | null;
  above: VecinoRival | null;
  below: VecinoRival | null;
}

/** Lo que hay que pintar, o null si no hay nada que decir. */
export interface Aviso {
  tipo: "perdiste" | "ganaste";
  nombre: string;
  /** Diferencia de XP con el vecino, siempre positiva. */
  delta: number;
  /**
   * Cuántos puestos se movieron, siempre positivo. Con 1 el vecino ES quien
   * te cruzó y se le puede nombrar como tal; con más, el movimiento pudo
   * venir de gente que ni siquiera estaba en la lista (ver `decidirAviso`), y
   * la tarjeta cuenta los puestos en vez de atribuir el adelantamiento.
   */
  saltos: number;
  pose: DotyPose;
  animacion: DotyAnimation;
}

export function claveSnapshot(userId: number): string {
  return `${PREFIJO}${userId}`;
}

/**
 * Tolera el formato viejo `{ rank }` —el que hay hoy en los navegadores de la
 * gente— tratándolo como semana desconocida: así la primera comprobación tras
 * actualizar no compara y nadie recibe un aviso falso.
 */
export function parsearSnapshot(raw: string | null): SnapshotRival | null {
  if (raw === null) return null;
  try {
    const v: unknown = JSON.parse(raw);
    // `typeof null === "object"` y `typeof [] === "object"`: sin los dos
    // descartes explícitos, un JSON válido que no es un objeto plano (null,
    // un array) se colaría como snapshot con los campos en null, en vez de
    // tratarse como "no hay snapshot".
    if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
    const o = v as { rank?: unknown; weekStart?: unknown };
    return {
      rank: typeof o.rank === "number" ? o.rank : null,
      weekStart: typeof o.weekStart === "string" ? o.weekStart : null,
    };
  } catch {
    return null;
  }
}

export function serializarSnapshot(snap: SnapshotRival): string {
  return JSON.stringify({ rank: snap.rank, weekStart: snap.weekStart });
}

function animacionValida(gesture: string | null): DotyAnimation | null {
  return gesture !== null && ANIMACIONES.includes(gesture)
    ? (gesture as DotyAnimation)
    : null;
}

/**
 * `actual` llega de `api.get<RivalData>(...)` (services/engagement.service.ts):
 * una aserción de tipo en compilación, sin ninguna validación en runtime. Por
 * eso `name` se recibe como `unknown` en vez de fiarse del `string` que
 * promete `VecinoRival` — cualquier cosa que no sea string cuenta como
 * ausente, no solo el string vacío.
 */
function nombreVisible(name: unknown): string {
  if (typeof name !== "string") return SIN_NOMBRE;
  return name.trim() === "" ? SIN_NOMBRE : name;
}

/**
 * Mismo límite sin validar que `nombreVisible`. `Math.abs(undefined)` da
 * `NaN` sin lanzar, y la tarjeta lo interpola tal cual en la frase — un delta
 * que no llegó como número finito se trata como si no hubiera diferencia.
 */
function deltaVisible(delta: unknown): number {
  return typeof delta === "number" && Number.isFinite(delta) ? Math.abs(delta) : 0;
}

/**
 * Compara el puesto guardado con el actual y decide qué se puede AFIRMAR.
 *
 * Nombrar al vecino como quien te cruzó solo es cierto cuando el puesto se
 * mueve exactamente UNA posición: ahí el de al lado es forzosamente el que
 * cambió de lado contigo. Con más de una, el movimiento puede no ser cosa
 * suya — estabas 3.º, no abres la app en tres días, entran dos cuentas nuevas
 * por encima de todos y acabas 5.º: `above` es quien ya era 2.º, que llevaba
 * toda la semana por delante y no te adelantó nunca. Por eso se devuelve
 * `saltos` y es la tarjeta la que elige un copy que no afirme un
 * adelantamiento que quizá no ocurrió.
 *
 * La rama de subida tiene exactamente el mismo agujero —subes porque
 * bloquearon a alguien de arriba, sin haber pasado a nadie—, así que el
 * tratamiento es simétrico. Lo que NO cambia en ningún caso es que se sigue
 * nombrando al vecino y mostrando un Doty en la tarjeta.
 */
export function decidirAviso(
  anterior: SnapshotRival | null,
  actual: EstadoRival,
): Aviso | null {
  if (anterior === null) return null;
  // Entre semanas no se compara: el ranking se reinicia y los puestos se
  // barajan sin que nadie te haya pasado.
  // `== null` y no `===`, igual que los guards de los vecinos: `actual` no se
  // valida en runtime, así que un backend viejo —el que aún no manda
  // `weekStart`— llega con `undefined` y tiene que cortar aquí, a propósito y
  // no de rebote en la comparación de abajo.
  if (anterior.weekStart == null || actual.weekStart == null) return null;
  if (anterior.weekStart !== actual.weekStart) return null;
  // Mismo `== null` por el mismo motivo: `rank` y `weekStart` nacieron juntos
  // en esta fase, así que el backend que no manda uno tampoco manda el otro.
  if (anterior.rank == null || actual.rank == null) return null;

  if (actual.rank > anterior.rank) {
    const vecino = actual.above;
    // `== null`, no `===`: `actual` no se valida en runtime (ver
    // nombreVisible/deltaVisible), así que un `undefined` real es tan
    // esperable como el `null` que promete el tipo.
    if (vecino == null) return null;
    const animacion = animacionValida(vecino.gesture);
    return {
      tipo: "perdiste",
      nombre: nombreVisible(vecino.name),
      delta: deltaVisible(vecino.delta),
      saltos: actual.rank - anterior.rank,
      // El sujeto del gesto es el rival presumiendo, nunca Doty burlándose de
      // ti: que te adelanten no es un fallo tuyo, es un mérito del otro.
      pose: animacion === null ? "flexeando" : gesturePose(animacion),
      animacion: animacion ?? "cheer",
    };
  }

  if (actual.rank < anterior.rank) {
    const vecino = actual.below;
    // Mismo motivo que en la rama de arriba: `== null` atrapa también un
    // `undefined` real, que el tipo no promete pero el servidor sí puede dar.
    if (vecino == null) return null;
    return {
      tipo: "ganaste",
      nombre: nombreVisible(vecino.name),
      delta: deltaVisible(vecino.delta),
      saltos: anterior.rank - actual.rank,
      // Aquí NUNCA el gesto del otro: el gesto es exclusivamente la carga del
      // aviso de derrota, y esa exclusividad es lo que lo convierte en un flex.
      pose: "aplaudiendo",
      animacion: "cheer",
    };
  }

  return null;
}
