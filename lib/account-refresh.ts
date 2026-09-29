/**
 * "Algo de MI cuenta cambió sin navegar" (spec modo admin 2026-09-29). Las
 * acciones de la caja de herramientas lo bumpean; el HUD, el Camino y el
 * arcade lo llevan en las dependencias de su efecto de carga y vuelven a
 * pedir. Sin esto habría que recargar la página, que tira el token en memoria
 * (CLAUDE.md regla 1). Puro, sin React, bajo node --test.
 */
let version = 0;
const escuchas = new Set<() => void>();

export function versionCuenta(): number {
  return version;
}

export function suscribirCuenta(alCambiar: () => void): () => void {
  escuchas.add(alCambiar);
  return () => {
    escuchas.delete(alCambiar);
  };
}

export function bumpCuenta(): void {
  version += 1;
  for (const alCambiar of escuchas) alCambiar();
}
