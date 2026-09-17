import type { UserSettings } from "@/services/settings.service";
import type { PlacementStatus } from "@/services/placement.service";

/**
 * Primer inicio guiado (spec §7.1). Lógica pura para poder probarse con
 * `node --test`: por eso SOLO admite `import type` — Node ejecuta este archivo
 * sin bundler y no resolvería el alias `@/`, y tampoco tiene `localStorage`,
 * de ahí las guardas de `typeof window`.
 */

/** Espejo local de "ya pasó por el primer inicio", hermano de dots-palette/theme/sound. */
export const ONBOARDED_KEY = "dots-onboarded";

export function leerEspejo(): boolean {
  try {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(ONBOARDED_KEY) === "1";
  } catch {
    return false;
  }
}

export function escribirEspejo(): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ONBOARDED_KEY, "1");
  } catch {
    // storage bloqueado: el servidor sigue siendo la verdad, solo se pierde el atajo
  }
}

export function borrarEspejo(): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(ONBOARDED_KEY);
  } catch {
    // ídem
  }
}

/**
 * ¿Esta cuenta ya pasó por el primer inicio? Sin ajustes devuelve `true`: el
 * servicio da `null` ante cualquier error de red, y mandar a `/welcome` a quien
 * no se pudo consultar lo atraparía en un bucle. Mismo criterio que la
 * redirección a placement del Camino, que también falla abierta.
 */
export function estaOnboardado(
  settings: Pick<UserSettings, "onboarded_at"> | null | undefined,
): boolean {
  if (!settings) return true;
  return typeof settings.onboarded_at === "string" && settings.onboarded_at.length > 0;
}

/**
 * A dónde va el usuario al cerrar la bienvenida. Replica la guardia de
 * `/onboarding`, que se autoexpulsa a `/levels` si el placement no se puede
 * tomar y no está activo: preguntarlo antes evita que la pantalla parpadee.
 */
export function rutaTrasBienvenida(
  status: Partial<PlacementStatus> | null | undefined,
): "/onboarding" | "/levels" {
  if (!status) return "/levels";
  return status.canTake === true || status.status === "active" ? "/onboarding" : "/levels";
}

// ── Flag compartido con el Camino ────────────────────────────────────────────

export type EstadoPrimerInicio = "desconocido" | "pendiente" | "hecho";

/**
 * El Camino redirige a `/onboarding` en cuanto `GET /path` trae
 * `placementPending`, y el gate redirige a `/welcome` en cuanto responde
 * `GET /me/settings`: en una cuenta nueva las dos carreras salen a la vez. El
 * gate publica aquí su veredicto y el Camino se aparta mientras valga
 * "pendiente". Con "desconocido" el Camino redirige como siempre: fallar
 * abierto es preferible a dejar a alguien sin placement.
 *
 * El Camino se suscribe (`suscribirPrimerInicio`) en vez de leer el veredicto
 * una sola vez: nada garantiza que el efecto del gate corra antes que el
 * suyo, así que una lectura suelta podía ver "desconocido" y redirigir a
 * placement de todos modos. Suscrito, el Camino reacciona en cuanto el
 * veredicto llega, sin importar quién se montó primero.
 */
let estado: EstadoPrimerInicio = "desconocido";
const escuchas = new Set<() => void>();

export function estadoPrimerInicio(): EstadoPrimerInicio {
  return estado;
}

/** Para `useSyncExternalStore`: el Camino necesita enterarse del veredicto. */
export function suscribirPrimerInicio(alCambiar: () => void): () => void {
  escuchas.add(alCambiar);
  return () => {
    escuchas.delete(alCambiar);
  };
}

export function fijarPrimerInicio(siguiente: EstadoPrimerInicio): void {
  if (estado === siguiente) return;
  estado = siguiente;
  for (const alCambiar of escuchas) alCambiar();
}
