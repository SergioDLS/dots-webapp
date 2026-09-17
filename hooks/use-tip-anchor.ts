"use client";

import { useEffect, useRef, useState } from "react";

import { bloquearScroll, hayScrollBloqueado } from "@/lib/scroll-lock";

/** Rectángulo del foco, en coordenadas de viewport, con su holgura ya sumada. */
export interface Recorte {
  top: number;
  left: number;
  width: number;
  height: number;
  radio: number;
}

/** Cada cuánto se mira si el objetivo ya está en el DOM. */
const INTERVALO_MS = 80;

/**
 * Lo que esperamos a que la pantalla pinte el objetivo, ya destapada. No es el
 * tiempo que tarda React en montar: el anclaje suele colgar del fetch pesado
 * de la propia pantalla (`/path` en el Camino, los juegos en el arcade, el
 * torneo en Retos), mientras que el reloj arranca cuando responde
 * `/me/settings`, que es el más ligero. En una primera carga fría en móvil
 * —justo cuando se enseñan las pistas— un presupuesto corto no llega.
 */
const ESPERA_MS = 6000;

/**
 * Techo absoluto mientras algo tape la pantalla: la animación de entrada de
 * Doty (entre 2,2 s y ~7,3 s) o un diálogo abierto. Ese tiempo NO gasta el
 * presupuesto de arriba; esto es el seguro por si algo se queda pegado.
 */
const ESPERA_TAPADO_MS = 20000;

/** Lo máximo que esperamos a que se quede quieta una animación del elemento. */
const ESPERA_ANIMACION_MS = 800;

/**
 * Segunda medición, para no congelarnos sobre algo que todavía se mueve. El
 * Camino programa su propio `scrollIntoView` suave 300 ms después de cargar, y
 * `overflow: hidden` no detiene un scroll programático.
 */
const ESPERA_CONFIRMACION_MS = 700;

/** Aire alrededor del elemento para que el foco no lo corte. */
const HOLGURA = 8;

/**
 * Espera a las animaciones finitas del propio elemento. `dots-pop-in` entra
 * desde `scale(.6)` y `getBoundingClientRect()` devuelve la caja YA
 * transformada: medir a mitad de vuelo dejaría un foco encogido. Las infinitas
 * (`dots-float`) no se esperan nunca, que no terminan; y las de los hijos
 * tampoco entran, porque un `transform` de un hijo no mueve la caja del padre.
 */
function animacionesQuietas(el: Element): Promise<unknown> {
  const pendientes = el
    .getAnimations()
    .filter((a) => a.effect != null && a.effect.getComputedTiming().iterations !== Infinity)
    .map((a) => a.finished.catch(() => undefined));
  if (pendientes.length === 0) return Promise.resolve(undefined);
  let corte = 0;
  return Promise.race([
    Promise.all(pendientes),
    new Promise((fin) => {
      corte = window.setTimeout(fin, ESPERA_ANIMACION_MS);
    }),
  ]).finally(() => clearTimeout(corte));
}

/**
 * Si el elemento cuelga de algo `sticky` o `fixed`, moverlo es imposible: se
 * queda clavado donde está y lo único que pasa es que la página salta. Se mira
 * la cadena entera de ancestros porque el anclaje suele ser un hijo — la llama
 * de la racha es un div dentro de una cabecera `sticky`, no la cabecera.
 */
function vaClavado(el: Element): boolean {
  let n: Element | null = el;
  while (n !== null && n !== document.body) {
    const pos = getComputedStyle(n).position;
    if (pos === "sticky" || pos === "fixed") return true;
    n = n.parentElement;
  }
  return false;
}

/**
 * Lo que tapan por arriba y por abajo las barras pegadas al viewport. Se miden
 * en vez de teclearse: un elemento puede caber en el viewport y aun así vivir
 * debajo de la cabecera, y como la pista se pinta por encima de todo, el
 * agujero enseñaría la cabecera en vez del objetivo. Solo cuenta lo que ocupa
 * una franja horizontal entera — el riel de escritorio va pegado a la
 * izquierda y no estorba ni por arriba ni por abajo.
 */
function barras(): { arriba: number; abajo: number } {
  let arriba = 0;
  let abajo = 0;
  // `vaClavado` y no la posición del propio elemento: la barra plegada del
  // Camino es un hijo `absolute` dentro de un envoltorio `sticky`, y por eso
  // lleva `data-chrome-fijo` — no es ni `header` ni `nav`.
  for (const el of document.querySelectorAll("header, nav, [data-chrome-fijo]")) {
    if (!vaClavado(el)) continue;
    const estilo = getComputedStyle(el);
    if (estilo.opacity === "0" || estilo.visibility === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (r.height === 0 || r.width < window.innerWidth * 0.8) continue;
    // Por la mitad en la que empieza, no por si toca el borde: la barra
    // plegada del Camino vive a 44 px del techo, debajo del HUD, y con la
    // regla del borde no contaría.
    if (r.top < window.innerHeight / 2) arriba = Math.max(arriba, r.bottom);
    else abajo = Math.max(abajo, window.innerHeight - r.top);
  }
  return { arriba, abajo };
}

/**
 * Encuentra el elemento marcado con `data-tip="<clave>"`, lo centra si hace
 * falta, lo mide y bloquea el scroll mientras se enseña la pista.
 *
 * Devuelve `null` mientras no haya nada que enseñar. Si el objetivo no llega a
 * aparecer, llama a `alRendirse` y se queda en `null`: una pista que no
 * encuentra a qué apuntar se salta en silencio, nunca bloquea al usuario ni a
 * las pistas que van detrás.
 */
export function useTipAnchor(clave: string | null, alRendirse?: () => void): Recorte | null {
  // El recorte viaja con la clave que lo midió: así, al pasar de una pista a
  // la siguiente, el valor viejo deja de ser válido sin tener que borrarlo
  // desde un efecto (regla 3).
  const [medida, setMedida] = useState<{ clave: string; recorte: Recorte } | null>(null);
  // Girar el teléfono mueve el objetivo y el recorte se quedaría apuntando al
  // aire. `ronda` obliga a medir otra vez sin borrar `medida`, para que la
  // pista no parpadee mientras se vuelve a colocar.
  const [ronda, setRonda] = useState(0);
  // Avisar de que nos rendimos va por callback y no por valor devuelto: el
  // consumidor tendría que convertirlo en estado desde un efecto, y la regla 3
  // no lo permite. Por ref, para que un callback recreado en cada render no
  // reinicie la búsqueda.
  const rendirse = useRef(alRendirse);
  useEffect(() => {
    rendirse.current = alRendirse;
  });

  useEffect(() => {
    if (clave === null) return;
    let vivo = true;
    let frame = 0;
    let reloj = 0;
    let confirmacion = 0;
    let soltar: (() => void) | null = null;
    const montaje = performance.now();
    let destapadoEn: number | null = null;

    const tomar = (el: Element) => {
      const r = el.getBoundingClientRect();
      const radio = Number.parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
      setMedida({
        clave,
        recorte: {
          top: r.top - HOLGURA,
          left: r.left - HOLGURA,
          width: r.width + HOLGURA * 2,
          height: r.height + HOLGURA * 2,
          radio: radio + HOLGURA,
        },
      });
    };

    const medir = (el: Element) => {
      if (!vivo) return;
      // Entre que lo encontramos y llegamos aquí pasa la espera de animaciones
      // (hasta 800 ms), así que se vuelve a mirar: puede haberse ido el
      // elemento, o haberse abierto un diálogo encima.
      if (!el.isConnected || hayScrollBloqueado()) {
        reloj = window.setTimeout(buscar, INTERVALO_MS);
        return;
      }
      // Corta cualquier scroll suave que siguiera en vuelo: el Camino programa
      // el suyo 300 ms después de cargar y `overflow: hidden` no lo detiene,
      // así que el contenido seguiría deslizándose bajo un foco ya congelado.
      window.scrollTo({ top: window.scrollY, behavior: "instant" });
      // Bloqueamos ANTES de medir: en un escritorio con barra de scroll clásica
      // esconder el overflow ensancha el viewport y recoloca lo centrado.
      soltar = bloquearScroll();
      tomar(el);
      confirmacion = window.setTimeout(() => {
        if (vivo && el.isConnected) tomar(el);
      }, ESPERA_CONFIRMACION_MS);
    };

    const buscar = () => {
      if (!vivo) return;
      const ahora = performance.now();

      // Tapado: la animación de entrada cubre la pantalla, o hay un diálogo
      // abierto (la hoja de ajustes, el selector de avatar). En los dos casos
      // medir daría un rectángulo que el usuario no puede mirar, y la pista se
      // pintaría debajo del diálogo. Esperar no gasta el presupuesto.
      const tapado =
        document.querySelector("[data-doty-entrada]") !== null ||
        hayScrollBloqueado() ||
        // Una pestaña de fondo también cuenta: con `setTimeout` el reloj sigue
        // corriendo donde `requestAnimationFrame` se habría parado, y la pista
        // se rendiría sin que nadie la haya podido mirar.
        document.visibilityState === "hidden";
      if (tapado) {
        // Se reinicia el reloj: el presupuesto es para que la pantalla pinte el
        // objetivo, y cualquier rato tapado —no solo el del principio— lo
        // habría gastado sin que el usuario pudiera ver nada.
        destapadoEn = null;
        if (ahora - montaje < ESPERA_TAPADO_MS) reloj = window.setTimeout(buscar, INTERVALO_MS);
        else rendirse.current?.();
        return;
      }
      if (destapadoEn === null) destapadoEn = ahora;
      if (ahora - destapadoEn >= ESPERA_MS) {
        rendirse.current?.();
        return;
      }

      const el = document.querySelector(`[data-tip="${clave}"]`);
      if (el === null) {
        reloj = window.setTimeout(buscar, INTERVALO_MS);
        return;
      }

      animacionesQuietas(el).then(() => {
        if (!vivo) return;
        if (!el.isConnected) {
          reloj = window.setTimeout(buscar, INTERVALO_MS);
          return;
        }
        // No lo movemos si va clavado, ni si ya está a la vista y despejado de
        // las barras. Si hay que moverlo, de golpe: `smooth` no avisa cuándo
        // terminó.
        const r = el.getBoundingClientRect();
        const { arriba, abajo } = barras();
        const dentro =
          r.top >= arriba + HOLGURA && r.bottom <= window.innerHeight - abajo - HOLGURA;
        if (!dentro && !vaClavado(el)) el.scrollIntoView({ block: "center", behavior: "instant" });
        frame = requestAnimationFrame(() => medir(el));
      });
    };

    reloj = window.setTimeout(buscar, 0);
    return () => {
      vivo = false;
      // Lo primero: el contador de `scroll-lock` es un punto único de fallo y
      // descuadrarlo deja el body sin scroll Y condena a toda pista futura a
      // esperar el techo entero y rendirse.
      soltar?.();
      clearTimeout(reloj);
      clearTimeout(confirmacion);
      cancelAnimationFrame(frame);
    };
  }, [clave, ronda]);

  useEffect(() => {
    if (clave === null) return;
    let espera = 0;
    let ultimo = `${window.innerWidth}x${window.innerHeight}`;
    // Con un respiro: arrastrar el borde de una ventana dispara `resize` en
    // cada fotograma. Y solo si el viewport cambió de verdad: medir toca el
    // `overflow` del body, y un `resize` que saliera de ahí realimentaría el
    // ciclo para siempre.
    const alCambiar = () => {
      const ahora = `${window.innerWidth}x${window.innerHeight}`;
      if (ahora === ultimo) return;
      ultimo = ahora;
      clearTimeout(espera);
      espera = window.setTimeout(() => setRonda((r) => r + 1), 150);
    };
    window.addEventListener("resize", alCambiar);
    window.addEventListener("orientationchange", alCambiar);
    return () => {
      clearTimeout(espera);
      window.removeEventListener("resize", alCambiar);
      window.removeEventListener("orientationchange", alCambiar);
    };
  }, [clave]);

  return medida !== null && medida.clave === clave ? medida.recorte : null;
}
