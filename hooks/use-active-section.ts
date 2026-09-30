"use client";

import { useEffect, useState } from "react";

/**
 * Índice de la sección del Camino que se está mirando: la última
 * `[data-section-id]` cuyo borde superior ya cruzó `line` px desde el techo del
 * viewport (justo bajo el chrome pegado). Antes de que ninguna cruce, 0; con el
 * scroll al fondo, la última, porque una sección final corta nunca llega a la
 * línea. `key` fuerza a medir de nuevo cuando cambian las secciones del DOM
 * (otra dificultad, el camino recién cargado).
 *
 * Scroll pasivo y un solo cálculo por frame. El `setState` va dentro del
 * callback de rAF, no en el cuerpo del efecto (regla 3).
 */
export function useActiveSection(key: unknown, line = 120): number {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const sections = document.querySelectorAll("[data-section-id]");
      if (sections.length === 0) return;
      const root = document.documentElement;
      if (window.scrollY > 0 && window.innerHeight + window.scrollY >= root.scrollHeight - 2) {
        setIndex(sections.length - 1);
        return;
      }
      let active = 0;
      sections.forEach((el, i) => {
        if (el.getBoundingClientRect().top <= line) active = i;
      });
      setIndex(active);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [key, line]);

  return index;
}
