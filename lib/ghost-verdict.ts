/**
 * ¿El jugador le ganó al fantasma? Gana quien responde todas las preguntas y
 * da su último paso antes que el último paso del fantasma.
 *
 * El veredicto normal lo decide el servidor (POST /ghost/run) contra el mejor
 * run de otro estudiante. Esta regla solo corre en el cliente cuando el
 * servidor no puede decidir: contra el Doty sintético, que no existe en la BD
 * (sin rival real el servidor siempre diría «perdiste»), o si el envío falla.
 * Solo decide lo que se muestra: los premios van por submitScore, aparte.
 * Pura, sin React, bajo node --test (ghost-verdict.test.mjs).
 */
export function ganoAlFantasma(input: {
  completo: boolean;
  mio: readonly number[];
  fantasma: readonly number[];
}): boolean {
  const miUltimo = input.mio.length > 0 ? input.mio[input.mio.length - 1] : Infinity;
  const suUltimo =
    input.fantasma.length > 0 ? input.fantasma[input.fantasma.length - 1] : Infinity;
  return input.completo && miUltimo < suUltimo;
}
