import {
  CLAVE_MARCA,
  marcarVista,
  parsearMarca,
  serializarMarca,
  type MarcaAviso,
} from "@/lib/install-prompt";

/**
 * El lado navegador de la invitación a instalar: el evento de Chromium y lo
 * que este dispositivo recuerda. Todo lo que aquí se toca —`window`,
 * `localStorage`, `sessionStorage`— es lo que `lib/install-prompt.ts` no
 * puede mirar, porque ese se prueba con `node --test`.
 *
 * Sobre el `beforeinstallprompt`:
 *
 * Es un evento de UNA sola oportunidad. Llega sin avisar —Chromium lo emite
 * cuando termina de verificar el manifest y el service worker, décimas o
 * segundos después de cargar—, no se repite, y si nadie llama a
 * `preventDefault()` el navegador enseña su propia barrita. Por eso el
 * listener se instala en el layout RAÍZ (components/pwa/install-capture.tsx)
 * y no donde se pinta la invitación: cuando el usuario termina su primera
 * lección, ese evento pasó hace rato.
 *
 * El módulo es el almacén: un singleton fuera de React, porque el evento
 * puede llegar entre dos renders y no hay componente al que entregárselo.
 */

/** Lo que Chromium emite. No está en lib.dom.d.ts: es propuesta, no estándar. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let guardado: BeforeInstallPromptEvent | null = null;
let arrancado = false;
const oyentes = new Set<() => void>();

function avisar(): void {
  for (const fn of oyentes) fn();
}

/**
 * Deja constancia de que esta app ya vive en la pantalla de inicio de este
 * dispositivo, para no volver a pedirlo nunca. Se escribe en cuanto el
 * sistema confirma la instalación, no cuando el usuario toca el botón: entre
 * una cosa y la otra hay un diálogo que se puede cancelar.
 */
function sellarInstalada(): void {
  // Si no había marca, se inventa una ya gastada: quien instala desde la
  // barrita del navegador, sin pasar por la invitación, tampoco debe verla
  // nunca. `leerMarca` y `guardarMarca` ya tragan sus propios errores — con
  // el storage bloqueado se pierde el sello, que es molesto y no roto:
  // `display-mode: standalone` callará la invitación igual en cuanto abra la
  // app instalada.
  const base = leerMarca() ?? marcarVista(null, Date.now());
  guardarMarca({ ...base, instalada: true });
}

/**
 * Instala los dos listeners, una sola vez por carga de página.
 *
 * NO devuelve función de limpieza a propósito. El efecto que llama a esto se
 * monta, se limpia y se vuelve a montar en StrictMode; si el cleanup quitara
 * el listener, un `beforeinstallprompt` que llegara en ese hueco se perdería
 * para siempre y el botón "Instalar" no aparecería en toda la sesión. Son dos
 * listeners pasivos que viven lo que vive la página: no hay nada que liberar.
 */
export function arrancarCaptura(): void {
  if (arrancado || typeof window === "undefined") return;
  arrancado = true;

  window.addEventListener("beforeinstallprompt", (e) => {
    // Sin esto Chromium enseña su propia barra de instalación, que compite
    // con la invitación de Doty y la deja pidiendo algo que ya se ofreció.
    e.preventDefault();
    guardado = e as BeforeInstallPromptEvent;
    avisar();
  });

  window.addEventListener("appinstalled", () => {
    // El evento gastado ya no sirve: llamarlo otra vez lanza.
    guardado = null;
    sellarInstalada();
    avisar();
  });
}

export function suscribir(fn: () => void): () => void {
  oyentes.add(fn);
  return () => {
    oyentes.delete(fn);
  };
}

/**
 * ¿Hay un evento guardado y listo para dispararse? Es la única lectura que
 * necesita `hooks/use-install-prompt.ts`: el resto del estado lo arma él en
 * su propia instantánea, junto con lo que le dicen los media queries.
 *
 * `instalada` no se expone porque no hace falta preguntarlo: cuando el
 * usuario acepta, el navegador abre la app instalada y ahí manda
 * `display-mode: standalone`. Lo que sí deja `appinstalled` es el sello en
 * localStorage, que es lo que calla la invitación en la pestaña que queda
 * abierta detrás.
 */
export function hayPromptNativo(): boolean {
  return guardado !== null;
}

/**
 * Abre el diálogo del sistema. Devuelve si el usuario aceptó.
 *
 * El evento se consume: aceptado o no, Chromium no lo vuelve a emitir en esta
 * carga, así que se suelta al terminar. Quien lo rechaza no vuelve a ver el
 * botón nativo hasta recargar — y eso está bien: insistir con el diálogo del
 * sistema es justo lo que hace que la gente lo bloquee.
 */
export async function lanzarPromptNativo(): Promise<boolean> {
  const evento = guardado;
  if (evento === null) return false;
  guardado = null;
  avisar();
  try {
    await evento.prompt();
    const { outcome } = await evento.userChoice;
    return outcome === "accepted";
  } catch {
    // El evento puede estar caducado si la página lleva mucho abierta.
    return false;
  }
}

// ── Lo que este dispositivo recuerda ──────────────────────────────────────

/**
 * La marca guardada, o `null` si no hay ninguna o el storage está cerrado.
 * Sin marca se enseña la invitación: es el lado seguro: molestar una vez de
 * más es mejor que no ofrecer nunca la instalación.
 */
export function leerMarca(): MarcaAviso | null {
  try {
    return parsearMarca(window.localStorage.getItem(CLAVE_MARCA));
  } catch {
    return null;
  }
}

/** Guarda la marca. Falla en silencio: sin espejo la invitación se repite, nada más. */
export function guardarMarca(marca: MarcaAviso): void {
  try {
    window.localStorage.setItem(CLAVE_MARCA, serializarMarca(marca));
  } catch {
    // modo privado o cuota llena
  }
}

/**
 * El disparo: "se acaba de terminar una actividad".
 *
 * Va en `sessionStorage` y no en un módulo en memoria porque quien lo escribe
 * (la pantalla de resultado, dentro del flujo inmersivo) y quien lo lee (el
 * hub) no comparten árbol de React, y entre los dos hay una navegación. Es de
 * sesión a propósito: un disparo que sobreviviera al cierre de la pestaña
 * enseñaría la invitación en una apertura fría, sin nada que celebrar.
 */
const CLAVE_DISPARO = "dots.install.disparo";

export function marcarActividadCompletada(): void {
  try {
    window.sessionStorage.setItem(CLAVE_DISPARO, "1");
  } catch {
    // sin sessionStorage no hay invitación automática; el Perfil sigue estando
  }
}

/** ¿Hay disparo pendiente? Mirar no lo consume. */
export function hayActividadCompletada(): boolean {
  try {
    return window.sessionStorage.getItem(CLAVE_DISPARO) === "1";
  } catch {
    return false;
  }
}

/**
 * Gasta el disparo. Se llama tanto si la invitación se va a enseñar como si
 * se descarta: dejarlo puesto lo convertiría en una invitación al acecho, que
 * saltaría en la siguiente pantalla del hub sin que nadie hubiera terminado
 * nada.
 */
export function consumirActividadCompletada(): void {
  try {
    window.sessionStorage.removeItem(CLAVE_DISPARO);
  } catch {
    // ídem
  }
}
