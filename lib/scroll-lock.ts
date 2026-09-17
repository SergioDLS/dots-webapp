/**
 * Dueño único del scroll del body.
 *
 * Tres sitios lo bloquean —la hoja de ajustes, el selector de avatar y las
 * pistas contextuales— y cada uno guardaba por su cuenta el valor anterior
 * para restaurarlo al cerrar. Con dos bloqueos vivos a la vez y un cierre en
 * orden distinto al de apertura, el segundo en soltar restauraba el "hidden"
 * que había guardado del primero y el body se quedaba sin scroll para
 * siempre: en una SPA no lo arregla ni navegar, solo recargar.
 *
 * Aquí hay un contador: bloquea el primero que llega y solo suelta el último
 * que se va. Cada llamada devuelve SU función de soltar, que es idempotente
 * —llamarla dos veces no descuenta dos— porque en StrictMode los efectos se
 * montan, se limpian y se vuelven a montar.
 */
let cuenta = 0;
let anterior = "";

/** Bloquea el scroll y devuelve la función que lo suelta. */
export function bloquearScroll(): () => void {
  if (cuenta === 0) {
    anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  cuenta += 1;
  let soltado = false;
  return () => {
    if (soltado) return;
    soltado = true;
    cuenta -= 1;
    if (cuenta === 0) document.body.style.overflow = anterior;
  };
}

/**
 * Si alguien tiene el scroll bloqueado hay un diálogo encima de la pantalla.
 * Lo usan las pistas para no colarse debajo de una hoja abierta.
 */
export function hayScrollBloqueado(): boolean {
  return cuenta > 0;
}
