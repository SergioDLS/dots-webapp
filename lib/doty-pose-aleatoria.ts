/**
 * Sorteo de pose de Doty seguro para hidratación.
 *
 * Elegir al azar durante el render rompe la hidratación: el servidor sortea una
 * pose y el cliente otra, y React se queja (o peor, se queda con la del
 * servidor en silencio). Y sin caché saldría una distinta en CADA render, así
 * que Doty parpadearía entre poses a cada tecla del formulario.
 *
 * Por eso se consume con `useSyncExternalStore`, que admite snapshots distintos
 * para servidor y cliente, y el cliente cachea su elección para toda la vida de
 * la página.
 *
 *   const sorteo = creaSorteo(POSES);
 *   const pose = useSyncExternalStore(sorteo.suscribir, sorteo.cliente, sorteo.servidor);
 */
export function creaSorteo<T extends string>(opciones: readonly T[]) {
  let elegida: T | null = null;
  return {
    cliente(): T {
      if (elegida === null) {
        elegida = opciones[Math.floor(Math.random() * opciones.length)];
      }
      return elegida;
    },
    /** Siempre la primera: no hay azar que sobreviva a la hidratación. */
    servidor(): T {
      return opciones[0];
    },
    /** La elección se toma una vez y no cambia mientras la página viva. */
    suscribir(): () => void {
      return () => {};
    },
  };
}
