import type { DotyPose } from "@/components/ui/doty/doty";
import type { IconName } from "@/components/ui/icon";

/**
 * Invitación a instalar la PWA: a quién se le ofrece, cuántas veces y con qué
 * tutorial.
 *
 * Lógica pura para poder probarse con `node --test`: por eso SOLO admite
 * `import type` — Node ejecuta este archivo sin bundler y no resolvería `@/`,
 * y tampoco tiene `localStorage`, de ahí que el estado entre y salga como
 * argumento en vez de leerse aquí.
 *
 * El reparto con el resto de la feature: este archivo DECIDE y REDACTA;
 * `hooks/use-install-prompt.ts` mira el navegador, y
 * `components/pwa/install-sheet.tsx` pinta.
 */

/**
 * El tutorial que toca. No es la plataforma: es lo que el usuario tiene que
 * hacer, que en iOS cambia con el navegador y dentro de una app ajena no
 * existe.
 */
export type Guion =
  /** El navegador se ofrece a instalar: un botón y se acabó. */
  | "nativo"
  /** Safari de iOS: Compartir → Añadir a pantalla de inicio. */
  | "ios-safari"
  /** Chrome, Firefox o Edge en iOS: lo mismo, pero en SU menú. */
  | "ios-navegador"
  /** Dentro de Instagram, Facebook y compañía: primero hay que salir. */
  | "ios-webview"
  /** Android sin prompt nativo (Firefox, o Chrome que ya la instaló). */
  | "android-menu"
  /** Webview de Android: tampoco instala, hay que abrir el navegador. */
  | "android-webview"
  /** Escritorio sin prompt nativo: se explica, pero no se ofrece solo. */
  | "escritorio";

export interface Paso {
  texto: string;
  /** El glifo del sistema que el paso manda tocar. */
  icono?: IconName;
}

export interface GuionTexto {
  titulo: string;
  frase: string;
  /** Lo que dice el botón principal. En "nativo" instala; en el resto, cierra. */
  cta: string;
  pose: DotyPose;
  pasos: readonly Paso[];
}

/**
 * Lo que Doty dice en cada caso. Escrito con las reglas de voz del spec §2.2
 * (docs/brand/doty-identity.md): Doty habla de sí mismo, nunca de "la
 * aplicación", y pide un favor en vez de dar una instrucción.
 *
 * Las comillas angulares son las del resto de la UI. Los nombres de los
 * botones van literales —"Añadir a pantalla de inicio"— porque el usuario los
 * va a buscar con los ojos: traducirlos a nuestro gusto sería mandarlo a
 * buscar un botón que no existe.
 */
export const GUIONES: Record<Guion, GuionTexto> = {
  nativo: {
    titulo: "¿Me pones en tu pantalla?",
    frase:
      "Entro como app de verdad: sin barra del navegador, a pantalla completa y con mi cara en tu inicio.",
    cta: "Instalar dots",
    pose: "en-celular",
    // Sin pasos a propósito: el botón ABRE el diálogo del sistema. Escribir
    // aquí lo que ese diálogo va a decir es inventarse la UI de Android.
    pasos: [],
  },
  "ios-safari": {
    titulo: "¿Me pones en tu pantalla?",
    frase: "iOS no me deja instalarme solo, así que te pido tres toques. Valen la pena.",
    cta: "¡Listo!",
    pose: "en-celular",
    pasos: [
      { texto: "Toca Compartir, en la barra de abajo", icono: "compartir" },
      { texto: "Baja y elige «Añadir a pantalla de inicio»", icono: "anadir-inicio" },
      { texto: "Toca «Añadir» y búscame en tu inicio", icono: "check" },
    ],
  },
  "ios-navegador": {
    titulo: "¿Me pones en tu pantalla?",
    frase: "Aquí el botón vive en el menú de tu navegador. Son tres toques y ya.",
    cta: "¡Listo!",
    pose: "en-celular",
    pasos: [
      { texto: "Abre el menú de tu navegador", icono: "menu-puntos" },
      { texto: "Elige «Añadir a pantalla de inicio»", icono: "anadir-inicio" },
      { texto: "Confirma con «Añadir»", icono: "check" },
    ],
  },
  "ios-webview": {
    titulo: "Sácame de aquí primero",
    frase:
      "Me estás viendo dentro de otra app, y desde aquí no puedo instalarme. Ábreme en Safari y seguimos.",
    cta: "Entendido",
    pose: "senalando",
    pasos: [
      { texto: "Abre el menú de la esquina", icono: "menu-puntos" },
      { texto: "Elige «Abrir en el navegador»", icono: "enlace" },
      { texto: "Ya en Safari: Compartir → «Añadir a pantalla de inicio»", icono: "compartir" },
    ],
  },
  "android-menu": {
    titulo: "¿Me pones en tu pantalla?",
    frase: "Tu navegador puede instalarme desde su menú. Son tres toques.",
    cta: "¡Listo!",
    pose: "en-celular",
    pasos: [
      { texto: "Abre el menú de tu navegador", icono: "menu-puntos" },
      { texto: "Elige «Instalar app» o «Añadir a pantalla de inicio»", icono: "anadir-inicio" },
      { texto: "Confirma y búscame en tu inicio", icono: "check" },
    ],
  },
  "android-webview": {
    titulo: "Sácame de aquí primero",
    frase:
      "Me estás viendo dentro de otra app, y desde aquí no puedo instalarme. Ábreme en tu navegador y seguimos.",
    cta: "Entendido",
    pose: "senalando",
    pasos: [
      { texto: "Abre el menú de la esquina", icono: "menu-puntos" },
      { texto: "Elige «Abrir en Chrome» o «Abrir en el navegador»", icono: "enlace" },
      { texto: "Ya ahí: menú → «Instalar app»", icono: "anadir-inicio" },
    ],
  },
  escritorio: {
    titulo: "Instálame aquí también",
    frase: "Donde mejor me veo es en el teléfono, pero en el escritorio también quepo.",
    cta: "Entendido",
    pose: "en-laptop",
    pasos: [
      { texto: "Mira al final de la barra de direcciones", icono: "anadir-inicio" },
      { texto: "Toca el icono de instalar y confirma", icono: "check" },
    ],
  },
};

/** Navegadores de iOS que NO son Safari pero sí saben añadir a la pantalla. */
const IOS_NAVEGADORES = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\//;

/**
 * Apps que abren la web dentro de sí mismas. La lista nombra a las que más
 * tráfico traen; el caso general se pilla abajo por otra vía.
 */
const WEBVIEWS = /FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|Twitter|TikTok|Snapchat/;

/**
 * ¿Es un iPhone o un iPad? El iPad moderno dice ser un Mac en su UA —cambió
 * en iPadOS 13 y no hay vuelta atrás—, así que la única pista que queda es
 * que un Mac de verdad no tiene pantalla táctil.
 */
export function esIOS(ua: string, tactil: boolean): boolean {
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return tactil && /Macintosh/.test(ua);
}

export interface PistasNavegador {
  /** Hay un `beforeinstallprompt` guardado y listo para dispararse. */
  nativo: boolean;
  /** `navigator.maxTouchPoints > 1`, lo único que delata a un iPad. */
  tactil?: boolean;
}

/**
 * Qué tutorial toca. El orden de las comprobaciones importa:
 *
 * iOS va PRIMERO, antes que `nativo`. Safari no dispara
 * `beforeinstallprompt` —ni lo implementa—, así que un evento ahí solo puede
 * venir de un navegador que miente o de un polyfill de terceros. Preferimos
 * enseñar los tres toques, que siempre funcionan, antes que un botón que
 * puede no hacer nada.
 */
export function detectarGuion(ua: string, pistas: PistasNavegador): Guion {
  const tactil = pistas.tactil ?? false;

  if (esIOS(ua, tactil)) {
    // Un WKWebView incrustado no lleva "Safari" en el UA; el Safari de verdad
    // sí, y los navegadores alternativos de iOS también (van sobre WebKit).
    // Por eso la ausencia basta como señal, y la lista de apps es solo el
    // atajo legible para las que más tráfico traen.
    if (WEBVIEWS.test(ua) || !/Safari/.test(ua)) return "ios-webview";
    if (IOS_NAVEGADORES.test(ua)) return "ios-navegador";
    return "ios-safari";
  }

  if (pistas.nativo) return "nativo";

  if (/Android/.test(ua)) {
    // "; wv)" es la marca que Android pone en el UA de todo WebView del
    // sistema: es lo que usan Instagram, Facebook y cualquier app con
    // navegador propio.
    if (/;\s*wv\)/.test(ua)) return "android-webview";
    return "android-menu";
  }

  return "escritorio";
}

/** Lo que este dispositivo recuerda del aviso. Por dispositivo, no por cuenta. */
export interface MarcaAviso {
  /** Cuántas veces se ha enseñado ya. */
  vistas: number;
  /** Cuándo fue la última, en ms de época. */
  ultima: number;
  /** Se instaló desde aquí: no se vuelve a ofrecer nunca. */
  instalada: boolean;
}

/**
 * Espejo local, hermano de `dots-onboarded` y `dots.rival.rank.*`. Va en
 * localStorage y NO en `users.settings` a propósito: instalar es un acto de
 * ESTE dispositivo. Guardado en el servidor, quien instalara en el teléfono
 * no volvería a ver la invitación en la tablet, que es justo donde todavía
 * hace falta.
 */
export const CLAVE_MARCA = "dots.install.aviso";

/** Se enseña dos veces como mucho. A la tercera ya no es una invitación. */
export const MAX_VISTAS = 2;

/** Lo que hay que esperar tras el primer "ahora no" para volver a pedirlo. */
export const ESPERA_SEGUNDA_MS = 14 * 24 * 60 * 60 * 1000;

/** Un número de verdad, o 0. Un `"3"` que venga de una versión vieja no cuela. */
function numero(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
}

/**
 * Lee la marca. Devuelve `null` ante cualquier cosa que no sea un objeto:
 * sin marca el aviso se enseña, que es el lado seguro del error —molestar una
 * vez de más es mejor que no ofrecer nunca la instalación.
 */
export function parsearMarca(raw: string | null): MarcaAviso | null {
  if (!raw) return null;
  let dato: unknown;
  try {
    dato = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof dato !== "object" || dato === null || Array.isArray(dato)) return null;
  const obj = dato as Record<string, unknown>;
  return {
    vistas: numero(obj.vistas),
    ultima: numero(obj.ultima),
    instalada: obj.instalada === true,
  };
}

export function serializarMarca(marca: MarcaAviso): string {
  return JSON.stringify(marca);
}

/** La marca que deja haber enseñado el aviso una vez más. */
export function marcarVista(marca: MarcaAviso | null, ahora: number): MarcaAviso {
  return {
    vistas: (marca?.vistas ?? 0) + 1,
    ultima: ahora,
    instalada: marca?.instalada ?? false,
  };
}

export interface EntradaAviso {
  /** Ya se está ejecutando como app instalada (`display-mode: standalone`). */
  instalada: boolean;
  /** Pantalla de teléfono: táctil y estrecha. */
  movil: boolean;
  guion: Guion;
  marca: MarcaAviso | null;
  ahora: number;
}

/**
 * ¿Se enseña el aviso? Lo llama el controlador cuando el usuario acaba de
 * terminar una actividad — este archivo no sabe nada de ese disparo, solo de
 * si es buen momento.
 *
 * Escrito a favor de NO enseñarlo: cada regla que falla corta. Pedir instalar
 * es un favor, y un favor que se pide dos veces ya es una molestia.
 */
export function decidirAviso(entrada: EntradaAviso): boolean {
  const { instalada, movil, guion, marca, ahora } = entrada;

  if (instalada) return false;
  // El aviso automático es cosa del teléfono: en el escritorio la invitación
  // vive en el Perfil, donde se busca a propósito.
  if (!movil) return false;
  if (guion === "escritorio") return false;
  if (marca === null) return true;
  if (marca.instalada) return false;
  if (marca.vistas >= MAX_VISTAS) return false;
  // La resta puede salir negativa si el reloj del sistema se movió hacia
  // atrás. Comparar "menor que la espera" lo trata como tiempo NO cumplido,
  // que es el lado prudente: un reloj mentiroso no debería adelantar la
  // segunda petición.
  return ahora - marca.ultima >= ESPERA_SEGUNDA_MS;
}
