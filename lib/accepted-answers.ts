/**
 * Respuestas aceptadas en el cliente (spec 2026-10-01 §4). La normalización
 * es gemela de `dots-backend/src/common/answer-alternatives.ts`: si cambias
 * una, cambia la otra.
 */

export function normalizarOracion(s: string): string {
  return String(s).replace(/\s+/g, " ").replace(/[\s.,;:!?]+$/, "").trim().toUpperCase();
}

export function normalizarPalabra(w: string): string {
  return String(w).trim().replace(/[.,;:!?]+$/, "").trim().toUpperCase();
}

/** «Arma la oración»: la referencia se compara como siempre (mayúsculas); las alternativas, normalizadas. */
export function esOracionAceptada(
  armada: string,
  referencia: string,
  alternativas: readonly string[] = [],
): boolean {
  if (armada.toUpperCase() === referencia.toUpperCase()) return true;
  const n = normalizarOracion(armada);
  return n !== "" && alternativas.some((a) => normalizarOracion(a) === n);
}

/**
 * Constructor: índice de la primera ficha mal puesta contra la secuencia
 * válida que más se le parece, o `null` si coincide entera con alguna.
 */
export function primerFalloEnOrden(
  bandeja: readonly string[],
  aceptadas: readonly (readonly string[])[],
): number | null {
  let mejor = -1;
  for (const seq of aceptadas) {
    if (seq.length !== bandeja.length) continue;
    let i = 0;
    while (i < seq.length && bandeja[i].toUpperCase() === seq[i].toUpperCase()) i++;
    if (i === seq.length) return null;
    if (i > mejor) mejor = i;
  }
  return mejor === -1 ? 0 : mejor;
}

/** Saca de las opciones incorrectas las palabras que también valen. */
export function sinAceptadas(opciones: readonly string[], aceptadas: readonly string[] = []): string[] {
  if (aceptadas.length === 0) return [...opciones];
  const fuera = new Set(aceptadas.map(normalizarPalabra));
  return opciones.filter((o) => !fuera.has(normalizarPalabra(o)));
}
