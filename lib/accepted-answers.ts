/**
 * Respuestas aceptadas en el cliente (spec 2026-10-01 §4). La normalización
 * es gemela de `dots-backend/src/common/answer-alternatives.ts`: si cambias
 * una, cambia la otra.
 *
 * Un orden aceptado de una oración solo vale mientras use las MISMAS fichas
 * que la oración (el mismo número). El servidor lo exige al crearlo, pero la
 * oración puede crecer después y entonces un orden viejo, más corto, daría por
 * buena una bandeja a medio armar: la práctica corrige en cada cambio y
 * «Confirmar» está listo desde la primera ficha. El servidor también los
 * filtra; aquí se vuelve a comprobar para no depender de eso.
 */

export function normalizarOracion(s: string): string {
  return String(s).replace(/\s+/g, " ").replace(/[\s.,;:!?]+$/, "").trim().toUpperCase();
}

export function normalizarPalabra(w: string): string {
  return String(w).trim().replace(/[.,;:!?]+$/, "").trim().toUpperCase();
}

/**
 * Las fichas de una oración, igual que `tokenizarOracion` del servidor (y que
 * `buildAnswer` del Constructor): por espacios y sin puntuación en la última.
 */
export function tokenizarOracion(s: string): string[] {
  const fichas = String(s)
    .split(/\s+/)
    .filter((t) => t.length > 0);
  if (fichas.length > 0) {
    fichas[fichas.length - 1] = fichas[fichas.length - 1].replace(/[.,;:!?]+$/, "");
  }
  return fichas.filter((t) => t.length > 0);
}

/**
 * «Arma la oración»: la referencia se compara como siempre (mayúsculas); las
 * alternativas, normalizadas y solo si tienen las fichas de la referencia.
 */
export function esOracionAceptada(
  armada: string,
  referencia: string,
  alternativas: readonly string[] = [],
): boolean {
  if (armada.toUpperCase() === referencia.toUpperCase()) return true;
  const n = normalizarOracion(armada);
  if (n === "") return false;
  const fichas = tokenizarOracion(referencia).length;
  return alternativas.some((a) => normalizarOracion(a) === n && tokenizarOracion(a).length === fichas);
}

/** La referencia se compara como siempre: ficha a ficha, en mayúsculas. */
function mismaFicha(a: string, b: string): boolean {
  return a.toUpperCase() === b.toUpperCase();
}

/**
 * Las alternativas se compararon con `tokenizarOracion`, que le quita la
 * puntuación a la ÚLTIMA ficha; las de la bandeja la conservan («morning,»),
 * así que aquí se comparan normalizadas.
 */
function mismaFichaNormalizada(a: string, b: string): boolean {
  return normalizarPalabra(a) === normalizarPalabra(b);
}

/**
 * Constructor: índice de la primera ficha mal puesta contra la secuencia
 * válida que más se le parece, o `null` si coincide entera con alguna.
 *
 * `aceptadas[0]` es la referencia y el resto, los órdenes que el admin aceptó
 * (así los manda el servidor en `answers`). Una alternativa solo cuenta si
 * tiene tantas fichas como la referencia.
 */
export function primerFalloEnOrden(
  bandeja: readonly string[],
  aceptadas: readonly (readonly string[])[],
): number | null {
  const fichas = aceptadas.length > 0 ? aceptadas[0].length : 0;
  let mejor = -1;
  for (let k = 0; k < aceptadas.length; k++) {
    const seq = aceptadas[k];
    if (seq.length !== bandeja.length) continue;
    if (k > 0 && seq.length !== fichas) continue;
    const igual = k === 0 ? mismaFicha : mismaFichaNormalizada;
    let i = 0;
    while (i < seq.length && igual(bandeja[i], seq[i])) i++;
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

/**
 * ¿Las palabras aceptadas se llevan TODAS las opciones incorrectas? Entonces
 * `sinAceptadas` las deja en cero y el ejercicio se queda con una sola opción.
 * Es el aviso del editor de respuestas aceptadas.
 *
 * Sin distractores no hay nada que cubrir (no fue lo aceptado lo que dejó una
 * sola opción) y los renglones en blanco no son opciones, así que no cuentan.
 */
export function cubreTodasLasIncorrectas(
  distractores: readonly string[],
  aceptadas: readonly string[],
): boolean {
  const opciones = distractores.filter((d) => normalizarPalabra(d) !== "");
  return opciones.length > 0 && sinAceptadas(opciones, aceptadas).length === 0;
}
