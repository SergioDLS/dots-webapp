"use client";

import { useEffect, useState } from "react";

/**
 * true mientras el elemento intersecta el viewport. `getTarget` se evalúa al
 * montar y cada vez que cambia `key` (p. ej. la dificultad mostrada: el nodo
 * actual es otro elemento). Sin `IntersectionObserver` (SSR, navegador viejo)
 * devuelve `initial` para siempre. El `setState` va dentro del callback del
 * observer, no en el cuerpo del efecto (regla 3).
 */
export function useInView(
  getTarget: () => Element | null,
  key: unknown,
  options: IntersectionObserverInit = {},
  initial = true,
): boolean {
  const [inView, setInView] = useState(initial);
  const { rootMargin = "0px", threshold = 0 } = options;

  useEffect(() => {
    const el = getTarget();
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin, threshold },
    );
    io.observe(el);
    return () => io.disconnect();
    // `key` fuerza a reobservar cuando el elemento objetivo cambia de identidad.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, rootMargin, threshold]);

  return inView;
}
