/**
 * Pendientes de la bandeja de reportes, para el puntito de Ajustes y del chip
 * ADMIN y el globo del panel (spec 2026-10-01 §2.1). Store de módulo, mismo
 * patrón que lib/admin-mode.ts y lib/account-refresh.ts.
 */
export type ConteoReportes = { content: number; bugs: number };

let conteo: ConteoReportes | null = null;
let version = 0;
const escuchas = new Set<() => void>();
const avisar = () => {
  for (const f of escuchas) f();
};

export function leerConteo(): ConteoReportes | null {
  return conteo;
}

export function versionConteo(): number {
  return version;
}

export function fijarConteo(siguiente: ConteoReportes): void {
  conteo = siguiente;
  avisar();
}

/** Tras cerrar reportes: los que miran el conteo vuelven a pedirlo. */
export function refrescarConteoReportes(): void {
  version += 1;
  avisar();
}

export function suscribirConteo(alCambiar: () => void): () => void {
  escuchas.add(alCambiar);
  return () => {
    escuchas.delete(alCambiar);
  };
}

export function totalPendientes(c: ConteoReportes | null): number {
  return c ? c.content + c.bugs : 0;
}

/** Una petición de conteo ya lanzada: de qué versión es y cuándo salió. */
export type PedidoConteo = { version: number; at: number };

/** Cuánto vale una petición ya hecha antes de volver a preguntar al servidor. */
export const VIGENCIA_MS = 2 * 60_000;

/**
 * ¿Le sirve esta petición a quien acaba de montar? Solo si es de la misma
 * versión Y tiene menos de VIGENCIA_MS. Lo primero hace que Ajustes, el chip y
 * el panel, montados a la vez, compartan una sola petición; lo segundo, que una
 * app abierta horas (una PWA) no se quede con el conteo del primer montaje.
 * `ahora` entra por parámetro para poder probarlo sin reloj.
 */
export function sigueVigente(
  pedido: PedidoConteo | null,
  versionActual: number,
  ahora: number,
): boolean {
  if (!pedido || pedido.version !== versionActual) return false;
  const edad = ahora - pedido.at;
  // edad < 0: el reloj del equipo retrocedió. No fiarse: volver a preguntar.
  return edad >= 0 && edad < VIGENCIA_MS;
}
