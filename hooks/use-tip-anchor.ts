"use client";

import { useEffect, useState } from "react";

/** Rectángulo del foco, en coordenadas de viewport, con su holgura ya sumada. */
export interface Recorte {
  top: number;
  left: number;
  width: number;
  height: number;
  radio: number;
}

/**
 * Lo que esperamos a que la pantalla pinte el elemento, ya destapada. Es tiempo
 * y no fotogramas: un contador de fotogramas valdría la mitad en un móvil de
 * 120 Hz, justo donde los fetch tardan más.
 */
const ESPERA_MS = 1500;

/**
 * Techo absoluto desde el montaje. La animación de entrada de Doty tapa la
 * pantalla entre 2,2 s (saludo) y 7,3 s (transformación + saludo), y mientras
 * tape NO gasta la espera de arriba; esto es solo el seguro por si se queda
 * pegada.
 */
const ESPERA_TAPADO_MS = 12000;

/** Lo máximo que esperamos a que se quede quieta una animación del elemento. */
const ESPERA_ANIMACION_MS = 800;

/** Aire alrededor del elemento para que el foco no lo corte. */
const HOLGURA = 8;

/**
 * Espera a las animaciones finitas del propio elemento. `dots-pop-in` entra
 * desde `scale(.6)` y `getBoundingClientRect()` devuelve la caja YA
 * transformada: medir a mitad de vuelo dejaría un foco encogido para siempre,
 * porque no se vuelve a medir. Las infinitas (`dots-float`) no se esperan
 * nunca, que no terminan; y las de los hijos tampoco entran, porque un
 * `transform` de un hijo no mueve la caja del padre.
 */
function animacionesQuietas(el: Element): Promise<unknown> {
  const pendientes = el
    .getAnimations()
    .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
    .map((a) => a.finished.catch(() => undefined));
  if (pendientes.length === 0) return Promise.resolve(undefined);
  return Promise.race([
    Promise.all(pendientes),
    new Promise((fin) => setTimeout(fin, ESPERA_ANIMACION_MS)),
  ]);
}

/**
 * Encuentra el elemento marcado con `data-tip="<clave>"`, lo centra si hace
 * falta, lo mide y bloquea el scroll mientras se enseña la pista.
 *
 * Devuelve `null` mientras no haya nada que enseñar, y también para siempre si
 * el elemento no llega a aparecer: una pista que no encuentra a qué apuntar se
 * salta en silencio, nunca bloquea al usuario.
 */
export function useTipAnchor(clave: string | null): Recorte | null {
  // El recorte viaja con la clave que lo midió: así, al pasar de una pista a
  // la siguiente, el valor viejo deja de ser válido sin tener que borrarlo
  // desde un efecto (regla 3).
  const [medida, setMedida] = useState<{ clave: string; recorte: Recorte } | null>(null);

  useEffect(() => {
    if (clave === null) return;
    let vivo = true;
    let frame = 0;
    /** Valor anterior de `overflow`, solo si llegamos a bloquear. */
    let previo: string | null = null;
    const montaje = performance.now();
    let destapadoEn: number | null = null;

    const medir = (el: Element) => {
      if (!vivo || !el.isConnected) return;
      // Bloqueamos ANTES de medir: en un escritorio con barra de scroll clásica
      // esconder el overflow ensancha el viewport y recoloca lo centrado. Si
      // midiéramos antes, el foco quedaría corrido esos píxeles. El bloqueo se
      // suelta en la limpieza de este mismo efecto, que corre al cambiar de
      // pista o al desmontar.
      previo = document.body.style.overflow;
      document.body.style.overflow = "hidden";
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

    const buscar = () => {
      if (!vivo) return;
      const ahora = performance.now();

      // Mientras la animación de entrada cubra la pantalla, lo que hay debajo
      // no se ve: medirlo daría un rectángulo que el usuario no puede mirar.
      if (document.querySelector("[data-doty-entrada]") !== null) {
        if (ahora - montaje < ESPERA_TAPADO_MS) frame = requestAnimationFrame(buscar);
        return;
      }
      if (destapadoEn === null) destapadoEn = ahora;
      if (ahora - destapadoEn >= ESPERA_MS) return;

      const el = document.querySelector(`[data-tip="${clave}"]`);
      if (el === null) {
        frame = requestAnimationFrame(buscar);
        return;
      }

      animacionesQuietas(el).then(() => {
        if (!vivo) return;
        if (!el.isConnected) {
          frame = requestAnimationFrame(buscar);
          return;
        }
        // Si ya está entero a la vista no lo movemos: la llama de la racha vive
        // en una cabecera `sticky` y centrarla es imposible — solo saltaría la
        // página con el elemento clavado donde estaba. Si hay que moverlo, de
        // golpe: `smooth` no avisa cuándo terminó.
        const r = el.getBoundingClientRect();
        const dentro = r.top >= HOLGURA && r.bottom <= window.innerHeight - HOLGURA;
        if (!dentro) el.scrollIntoView({ block: "center", behavior: "instant" });
        frame = requestAnimationFrame(() => medir(el));
      });
    };

    frame = requestAnimationFrame(buscar);
    return () => {
      vivo = false;
      cancelAnimationFrame(frame);
      if (previo !== null) document.body.style.overflow = previo;
    };
  }, [clave]);

  return medida !== null && medida.clave === clave ? medida.recorte : null;
}
