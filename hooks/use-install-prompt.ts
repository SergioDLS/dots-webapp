"use client";

import { useCallback, useSyncExternalStore } from "react";

import { hayPromptNativo, lanzarPromptNativo, suscribir } from "@/lib/install-browser";
import { detectarGuion, type Guion } from "@/lib/install-prompt";

/**
 * Lo que el navegador dice sobre instalar: si ya está instalada, si esto es
 * un teléfono y qué tutorial toca.
 *
 * Todo el cálculo vive DENTRO de la instantánea del store, no en el cuerpo
 * del hook. `matchMedia` y `navigator` en el render romperían la hidratación
 * —el servidor no sabe nada de la pantalla ni del navegador (regla 12)— y el
 * compilador de React tampoco admite leerlos ahí. Con `useSyncExternalStore`,
 * el render de hidratación usa la instantánea del servidor y el valor real
 * entra después, en un segundo render.
 */

/** La app abierta desde su icono, sin barra de direcciones. */
const MQ_STANDALONE = "(display-mode: standalone)";
/** El breakpoint `md` de Tailwind: por debajo, la UI ya está en modo teléfono. */
const MQ_ESTRECHO = "(max-width: 767px)";
/** Dedo, no ratón. El ancho solo no basta: una ventana estrecha no es un móvil. */
const MQ_TACTIL = "(pointer: coarse)";

/** iOS antes de 16.4 no entendía `display-mode`; esto es lo que sí entendía. */
interface NavegadorIOS extends Navigator {
  standalone?: boolean;
}

/**
 * La instantánea es un STRING, no un objeto: `useSyncExternalStore` compara
 * por identidad y un objeto nuevo en cada lectura sería un bucle de renders.
 * El primer campo marca de dónde viene —"s" servidor, "c" cliente— porque el
 * resto de los campos pueden coincidir por casualidad con los del servidor y
 * entonces no habría forma de saber si ya hay datos de verdad.
 */
const SERVIDOR = `s|0|0|escritorio`;

function instantanea(): string {
  const standalone =
    window.matchMedia(MQ_STANDALONE).matches ||
    (window.navigator as NavegadorIOS).standalone === true;
  const movil =
    window.matchMedia(MQ_ESTRECHO).matches && window.matchMedia(MQ_TACTIL).matches;
  const guion = detectarGuion(window.navigator.userAgent, {
    nativo: hayPromptNativo(),
    tactil: window.navigator.maxTouchPoints > 1,
  });
  return `c|${standalone ? 1 : 0}|${movil ? 1 : 0}|${guion}`;
}

function suscribirTodo(alCambiar: () => void): () => void {
  const soltarEvento = suscribir(alCambiar);
  const listas = [MQ_STANDALONE, MQ_ESTRECHO, MQ_TACTIL].map((q) => window.matchMedia(q));
  for (const lista of listas) lista.addEventListener("change", alCambiar);
  return () => {
    soltarEvento();
    for (const lista of listas) lista.removeEventListener("change", alCambiar);
  };
}

export interface EstadoInstalacion {
  /** Ya hidratado: hasta entonces lo demás son valores de relleno. */
  listo: boolean;
  /** Abierta desde el icono: no hay nada que ofrecer. */
  instalada: boolean;
  /** Teléfono: estrecho y táctil. */
  movil: boolean;
  guion: Guion;
  /** Abre el diálogo del sistema. Devuelve si aceptó; `false` si no hay prompt. */
  instalar: () => Promise<boolean>;
}

export function useInstallPrompt(): EstadoInstalacion {
  const snap = useSyncExternalStore(suscribirTodo, instantanea, () => SERVIDOR);
  const [origen, standalone, movil, guion] = snap.split("|");

  const instalar = useCallback(() => lanzarPromptNativo(), []);

  return {
    listo: origen === "c",
    instalada: standalone === "1",
    movil: movil === "1",
    guion: guion as Guion,
    instalar,
  };
}
