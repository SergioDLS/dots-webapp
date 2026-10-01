import { candidatosDeReporte, type ReportTarget } from "./report.ts";

/**
 * Qué hay en pantalla para reportar (spec 2026-10-01 §1.2). Store de módulo,
 * mismo patrón que lib/admin-mode.ts: la pantalla que conoce el ejercicio
 * publica, la banderita lee con `useSyncExternalStore`. Hace falta porque en
 * vocabulario, letras y números el estado vive en componentes hijos y la
 * barra la pinta el padre.
 *
 * Publicar compara una firma (claves, modos, respuestas y fallos): si nada
 * cambió no avisa, así que una pantalla que publica en cada render no provoca
 * bucles. El modo entra porque un padre que cambia de etapa puede publicar el
 * mismo ítem con otro modo (letras: una sola letra nueva en la presentación y
 * luego en la práctica directa): sin él esa publicación se tragaría y el
 * reporte saldría con el modo viejo.
 */
let actuales: readonly ReportTarget[] = [];
let anterior: ReportTarget | null = null;
let candidatos: ReportTarget[] = [];
let firma = "";
const escuchas = new Set<() => void>();

const firmaDe = (lista: readonly ReportTarget[]) =>
  lista.map((t) => `${t.key}|${t.mode ?? ""}|${t.answer ?? ""}|${String(t.wasWrong)}`).join("·");

function recalcular(): void {
  candidatos = candidatosDeReporte(actuales, anterior);
  for (const alCambiar of escuchas) alCambiar();
}

export function publicarObjetivos(lista: readonly ReportTarget[]): void {
  const nueva = firmaDe(lista);
  if (nueva === firma) return;
  firma = nueva;
  actuales = lista;
  recalcular();
}

/** Desde el handler que corrige (un evento, nunca un efecto: regla 3). */
export function registrarRespondido(t: ReportTarget): void {
  anterior = t;
  recalcular();
}

/** Al salir de la pantalla: nada queda colgado para la siguiente. */
export function limpiarObjetivos(): void {
  actuales = [];
  anterior = null;
  firma = "";
  recalcular();
}

export function leerCandidatos(): ReportTarget[] {
  return candidatos;
}

export function suscribirObjetivos(alCambiar: () => void): () => void {
  escuchas.add(alCambiar);
  return () => {
    escuchas.delete(alCambiar);
  };
}
