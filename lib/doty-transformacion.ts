import { creaSorteo } from "@/lib/doty-pose-aleatoria";

/**
 * La animación del Doty clásico transformándose en el nuevo: cuándo se
 * reproduce y cuándo no.
 *
 * Es un hito de marca de UNA sola vez por usuario, así que toda la lógica está
 * escrita a favor de NO reproducirla. El fallo caro no es que alguien se la
 * pierda — es que la vea en cada arranque: va montada sobre el redirect que
 * saca al usuario del login, y ese redirect existe porque en la PWA instalada
 * (sin barra de direcciones) quedarse ahí con sesión válida es una ratonera
 * (ver el comentario de app/page.tsx). Un adorno no puede convertirse en un
 * peaje de tres segundos en cada apertura de la app.
 */

export const TRANSFORMACION_SRC = "/images/doty-transformacion.webp";
export const SALUDO_SRC = "/images/doty-saludo.webp";

/**
 * Duraciones reales de cada clip: fotogramas × 83 ms, que es lo que escribe
 * `scripts/mj/compose-transformacion.py`. Un WebP animado no emite `ended`, así
 * que el fin se detecta con un temporizador y estas cifras tienen que seguir a
 * las del script — si cambia el recorte o el ritmo, cambian las dos.
 */
export const TRANSFORMACION_MS = 61 * 83;
export const SALUDO_MS = 27 * 83;

/**
 * Cuánto se espera a que el asset esté decodificado antes de rendirse y
 * navegar. Solo corre para quien aún no la ha visto, y una única vez en su
 * vida. Quien llega por el formulario ya ha tenido todo el tiempo de escribir
 * la contraseña para descargarlo; esta espera es para quien entra con la sesión
 * rehidratada, que no pasa por el formulario y llega aquí en milisegundos.
 */
export const ESPERA_MAX_MS = 2500;

/**
 * Lo que tarda el login en desvanecerse antes de navegar, encadenando con el
 * fundido de entrada del overlay. Tiene que coincidir con la duración que
 * `app/page.tsx` le pasa a `dots-salida-login`: si la navegación llega antes, se
 * ve el corte que esto viene a evitar.
 */
export const SALIDA_MS = 200;

const CLAVE = "dots_doty_transformacion_vista";

/**
 * Después de esta fecha no se reproduce, haya marca o no. Es la red de
 * seguridad: si el localStorage falla de una forma que no previmos, el daño
 * queda acotado en el tiempo en vez de ser permanente. Y deja que la animación
 * muera sola, sin necesidad de un deploy.
 */
const CADUCA = Date.parse("2026-12-01T00:00:00Z");

/** Con `prefers-reduced-motion` no se reproduce: es accesibilidad, no un extra. */
function prefiereMenosMovimiento(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function yaVista(): boolean {
  try {
    return window.localStorage.getItem(CLAVE) === "1";
  } catch {
    // Modo privado o almacenamiento bloqueado: sin forma de recordarlo, la
    // única respuesta segura es "ya la vio". Ver la nota de arriba.
    return true;
  }
}

export function marcarVista(): void {
  try {
    window.localStorage.setItem(CLAVE, "1");
  } catch {
    // Si no se puede escribir, no se puede garantizar que sea una sola vez.
    // Quien llame a esto decide; aquí no se lanza.
  }
}

/**
 * Se llama UNA vez, al montar el login, y decide si vale la pena siquiera
 * descargar el asset: son 653 kB que no tiene sentido pedirle a quien ya la vio
 * — que pasadas unas semanas es todo el mundo.
 */
export function debeAnimar(): boolean {
  if (typeof window === "undefined") return false;
  if (Date.now() >= CADUCA) return false;
  if (prefiereMenosMovimiento()) return false;
  return !yaVista();
}

/**
 * La decisión, cacheada para toda la vida de la página.
 *
 * Dos motivos, y los dos son bugs que ya mordieron:
 *
 * 1. El login se renderiza en el servidor aunque sea un componente de cliente,
 *    y allí `debeAnimar()` vale `false` por no haber `window`. Con un
 *    `useState(debeAnimar)` el valor del servidor sobrevive a la hidratación y
 *    la animación no se reproduce JAMÁS, sin un solo error en consola. Por eso
 *    se consume con `useSyncExternalStore`, que tiene un snapshot distinto para
 *    servidor y cliente.
 * 2. `marcarVista()` se escribe ANTES de animar, así que sin caché la siguiente
 *    llamada devolvería `false` y el componente se desmontaría a media
 *    animación.
 *
 * `useSyncExternalStore` además exige que el snapshot sea estable entre
 * renders: devolver un `debeAnimar()` fresco cada vez es justo lo que React
 * detecta como bucle infinito.
 */
let decision: boolean | null = null;

export function snapshotCliente(): boolean {
  if (decision === null) decision = debeAnimar();
  return decision;
}

/** En el servidor nunca se anima: no hay localStorage que consultar. */
export function snapshotServidor(): boolean {
  return false;
}

/** La decisión se toma una vez y no cambia mientras la página viva. */
export function suscribir(): () => void {
  return () => {};
}

/* ── Traspaso del login a la pantalla de entrada ──────────────────────────── */

/**
 * Qué debe reproducir el overlay. Lo decide el login, que es la única puerta de
 * entrada y lo único que sabe distinguir un login con formulario de una sesión
 * rehidratada desde la cookie. `/levels` no puede saberlo, así que se lo dicen.
 */
export type Entrada = "transformacion" | "saludo";

const CLAVE_ENTRADA = "dots_doty_entrada";

/**
 * `sessionStorage` y no un parámetro de URL ni contexto: el parámetro quedaría
 * visible, sobreviviría a un refresco y se compartiría con el enlace; el
 * contexto se pierde en una recarga completa. Esto es un traspaso de una sola
 * navegación, que es exactamente para lo que sirve.
 */
export function pedirEntrada(que: Entrada): void {
  try {
    window.sessionStorage.setItem(CLAVE_ENTRADA, que);
  } catch {
    // Sin sesión de almacenamiento no hay animación. No es motivo para fallar.
  }
}

/** Lee y CONSUME: llamarla dos veces devuelve null la segunda. */
export function tomarEntrada(): Entrada | null {
  try {
    const v = window.sessionStorage.getItem(CLAVE_ENTRADA);
    if (v) window.sessionStorage.removeItem(CLAVE_ENTRADA);
    return v === "transformacion" || v === "saludo" ? v : null;
  } catch {
    return null;
  }
}

/**
 * Igual que `snapshotCliente`, y por el mismo motivo: el layout del hub también
 * se renderiza en el servidor. Además `tomarEntrada()` CONSUME la clave, así que
 * sin caché el segundo render devolvería null y el overlay se desmontaría a
 * media animación.
 */
let entradaCache: Entrada | null | undefined;

export function entradaCliente(): Entrada | null {
  if (entradaCache === undefined) entradaCache = tomarEntrada();
  return entradaCache;
}

export function entradaServidor(): Entrada | null {
  return null;
}

/* ── Pose del login ───────────────────────────────────────────────────────── */

/**
 * Poses que Doty puede tener en el login una vez pasada la transformación.
 *
 * El criterio es estrecho a propósito: **Doty tiene que mirar al usuario y
 * hacer un gesto hacia él**. No basta con que la pose sea positiva. Quedaron
 * fuera `bailando` y `aplaudiendo` (celebran algo que aquí no ha pasado),
 * `riendo` y `muy-feliz` (ojos cerrados: alegría sin destinatario), `idea` y
 * `leyendo` (contexto de estudio, ni miran), y `timido` (se retrae en vez de
 * recibir). Todo lo negativo está fuera por definición — la puerta de entrada
 * no recibe a nadie con mala cara, y el canon dice que Doty motiva y nunca
 * regaña.
 *
 * `saludando` va primera a propósito: es la que se usa en el servidor.
 */
export const POSES_LOGIN = [
  "saludando",
  "bienvenido",
  "feliz",
  "emocionado",
  "pulgar-arriba",
  "saltando",
] as const;

export const sorteoLogin = creaSorteo(POSES_LOGIN);

/* ── ¿Ya conoce al Doty nuevo? ────────────────────────────────────────────── */

/**
 * El rediseño es una sorpresa que se revela DENTRO de la app — con la
 * transformación, o simplemente al entrar. Así que ninguna pantalla previa a la
 * sesión (login, /forgot, /invite) puede enseñar el Doty nuevo a quien no lo ha
 * visto todavía. Esta es la pregunta que decide eso, y es otra distinta de
 * `debeAnimar()`: reduced-motion y CADUCA apagan la animación, no la sorpresa.
 *
 * La señal es "este dispositivo ha tenido una sesión abierta": quien entra ve al
 * Doty nuevo en el Camino, así que ya no hay nada que esconderle. Se escribe en
 * `setAccessToken` de auth-context, que es el único punto por el que pasan el
 * login con formulario, la sesión rehidratada desde la cookie y la aceptación
 * de una invitación.
 *
 * No se usa el espejo del avatar: el logout lo borra, y quien ya vio la
 * transformación volvería a ver el clásico al cerrar sesión. Esta marca tampoco
 * la borra el logout — como la de la transformación, es del dispositivo, no de
 * la cuenta.
 */
const CLAVE_CONOCIDO = "dots_doty_nuevo_conocido";

export function marcarConocido(): void {
  try {
    window.localStorage.setItem(CLAVE_CONOCIDO, "1");
  } catch {
    // Sin almacenamiento, la próxima visita vuelve a ver el clásico. Es el lado
    // barato del error.
  }
}

/**
 * Al revés que `yaVista()`: si el almacenamiento falla, la respuesta segura es
 * "no lo conoce". Allí el fallo caro era animar en cada arranque; aquí es
 * estropear la sorpresa, y ver el clásico en el login no le cuesta nada a nadie.
 */
export function conoceDotyNuevo(): boolean {
  try {
    const ls = window.localStorage;
    return ls.getItem(CLAVE_CONOCIDO) === "1" || ls.getItem(CLAVE) === "1";
  } catch {
    return false;
  }
}

/**
 * Cacheada como `snapshotCliente`, y por lo mismo: la página se renderiza en el
 * servidor y el snapshot tiene que ser estable. Además `marcarConocido()` se
 * escribe mientras el login sigue en pantalla (al llegar el token), y sin caché
 * Doty cambiaría de identidad justo antes del redirect — o a mitad de la
 * transformación, que arranca desde el clásico.
 */
let conocido: boolean | null = null;

export function conocidoCliente(): boolean {
  if (conocido === null) conocido = conoceDotyNuevo();
  return conocido;
}

/** En el servidor no hay marca que leer: se pinta el clásico. */
export function conocidoServidor(): boolean {
  return false;
}
