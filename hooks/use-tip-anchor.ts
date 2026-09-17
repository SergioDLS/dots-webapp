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

/** ~1,5 s a 60 fps. Si en ese tiempo la pantalla no lo pintó, no se insiste. */
const INTENTOS_MAX = 90;

/** Aire alrededor del elemento para que el foco no lo corte. */
const HOLGURA = 8;

/**
 * Encuentra el elemento marcado con `data-tip="<clave>"`, lo centra, lo mide y
 * bloquea el scroll mientras se enseña la pista.
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
    let intentos = 0;

    const buscar = () => {
      if (!vivo) return;
      // Mientras la animación de entrada cubra la pantalla, lo que hay debajo
      // no se ve: medirlo daría un rectángulo que el usuario no puede mirar.
      const tapado = document.querySelector("[data-doty-entrada]") !== null;
      const el = tapado ? null : document.querySelector(`[data-tip="${clave}"]`);

      if (el) {
        // `auto` y no `smooth`: el suave no avisa cuándo terminó.
        el.scrollIntoView({ block: "center", behavior: "auto" });
        frame = requestAnimationFrame(() => {
          if (!vivo) return;
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
        });
        return;
      }

      intentos += 1;
      if (intentos < INTENTOS_MAX) frame = requestAnimationFrame(buscar);
    };

    frame = requestAnimationFrame(buscar);
    return () => {
      vivo = false;
      cancelAnimationFrame(frame);
    };
  }, [clave]);

  const listo = medida !== null && medida.clave === clave;

  useEffect(() => {
    if (!listo) return;
    // Mismo bloqueo que components/profile/settings-sheet.tsx: con el scroll
    // parado, el rectángulo medido sigue siendo válido mientras dure la pista.
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = antes;
    };
  }, [listo]);

  return listo ? medida.recorte : null;
}
