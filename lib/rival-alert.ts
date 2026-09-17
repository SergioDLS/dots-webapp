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

function nombreVisible(name: string): string {
  return name.trim() === "" ? SIN_NOMBRE : name;
}

/**
 * Un puesto en un ranking solo empeora si alguien te cruzó, así que quien
 * quede justo encima ES alguien que te pasó; y solo mejora si tú cruzaste a
 * alguien, que es quien queda justo debajo. No hace falta rastrear identidades.
 */
export function decidirAviso(
  anterior: SnapshotRival | null,
  actual: EstadoRival,
): Aviso | null {
  if (anterior === null) return null;
  // Entre semanas no se compara: el ranking se reinicia y los puestos se
  // barajan sin que nadie te haya pasado.
  if (anterior.weekStart === null || actual.weekStart === null) return null;
  if (anterior.weekStart !== actual.weekStart) return null;
  if (anterior.rank === null || actual.rank === null) return null;

  if (actual.rank > anterior.rank) {
    const vecino = actual.above;
    if (vecino === null) return null;
    const animacion = animacionValida(vecino.gesture);
    return {
      tipo: "perdiste",
      nombre: nombreVisible(vecino.name),
      delta: Math.abs(vecino.delta),
      // El sujeto del gesto es el rival presumiendo, nunca Doty burlándose de
      // ti: que te adelanten no es un fallo tuyo, es un mérito del otro.
      pose: animacion === null ? "flexeando" : gesturePose(animacion),
      animacion: animacion ?? "cheer",
    };
  }

  if (actual.rank < anterior.rank) {
    const vecino = actual.below;
    if (vecino === null) return null;
    return {
      tipo: "ganaste",
      nombre: nombreVisible(vecino.name),
      delta: Math.abs(vecino.delta),
      // Aquí NUNCA el gesto del otro: el gesto es exclusivamente la carga del
      // aviso de derrota, y esa exclusividad es lo que lo convierte en un flex.
      pose: "aplaudiendo",
      animacion: "cheer",
    };
  }

  return null;
}
