"use client";
import { useEffect, useRef, useState } from "react";

const DEFAULT_DURATION_MS = 900;
const FRAME_MS = 33; // ~30 fps: suficiente para que el número se lea subiendo

/** Desaceleración: el número corre al principio y frena al llegar. */
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Cuenta ascendente hasta `target`, para marcadores de fin de partida.
 *
 * No anima CSS: solo emite números, así que es portable a RN tal cual y no
 * toca layout. Respeta `prefers-reduced-motion` — con la preferencia activa
 * devuelve el valor final de inmediato, sin conteo (movimiento reducido no
 * debe convertir un dato en algo que hay que esperar).
 *
 * El caso "sin conteo" se resuelve en el return, no con un `setState` en el
 * cuerpo del efecto: eso dispara `react-hooks/set-state-in-effect` (regla 3).
 */
export function useCountUp(
  target: number,
  durationMs: number = DEFAULT_DURATION_MS,
): number {
  const [value, setValue] = useState(0);
  const idRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Se resuelve una vez: la preferencia no cambia a mitad de una partida
  const [reduced] = useState(prefersReducedMotion);

  const instant = reduced || target <= 0 || durationMs <= 0;

  useEffect(() => {
    if (instant) return;
    if (idRef.current) clearInterval(idRef.current);

    const startedAt = Date.now();
    idRef.current = setInterval(() => {
      const t = Math.min(1, (Date.now() - startedAt) / durationMs);
      setValue(Math.round(target * easeOut(t)));
      if (t >= 1 && idRef.current) {
        clearInterval(idRef.current);
        idRef.current = null;
      }
    }, FRAME_MS);

    return () => {
      if (idRef.current) {
        clearInterval(idRef.current);
        idRef.current = null;
      }
    };
  }, [target, durationMs, instant]);

  return instant ? target : value;
}
