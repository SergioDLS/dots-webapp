"use client";

import { useCallback, useRef } from "react";

import { BASE_URL_SOUNDS } from "@/constants";

/** URLs absolutas (Cloudinary) pasan tal cual; rutas legacy se resuelven. */
export const resolveLessonAudio = (src: string) =>
  /^https?:\/\//.test(src) ? src : `${BASE_URL_SOUNDS}/${src}`;

/**
 * Un único elemento Audio por lección: cada play pisa el clip anterior, así
 * nunca se solapan (autoplay de turno + refuerzo al acertar + taps manuales).
 * El primer play siempre sale de un tap ("Practicar"/opciones), lo que activa
 * el origen; los siguientes pueden dispararse desde efectos de cambio de turno
 * — mismo principio que GameIntro.
 */
export function useLessonAudio(): (src?: string | null) => void {
  const ref = useRef<HTMLAudioElement | null>(null);

  return useCallback((src?: string | null) => {
    if (!src) return;
    let el = ref.current;
    if (!el) {
      el = new Audio();
      ref.current = el;
    }
    el.pause();
    el.src = resolveLessonAudio(src);
    el.currentTime = 0;
    void el.play().catch(() => {});
  }, []);
}
