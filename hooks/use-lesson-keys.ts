"use client";

import { useEffect } from "react";

interface LessonKeysOptions {
  /** Enter / Espacio en pantallas de fin → confirmar o continuar */
  onEnter?: () => void;
  /** Teclas 1-9 → seleccionar la opción n (índice 0-based) */
  onSelect?: (index: number) => void;
  /** Ctrl/Cmd+Espacio → repetir audio */
  onReplay?: () => void;
  /** Desactiva los atajos (p. ej. en pantallas sin opciones) */
  enabled?: boolean;
}

/**
 * Atajos de teclado para lecciones en desktop: Enter (confirmar/continuar),
 * 1-9 (elegir opción), Ctrl/Cmd+Espacio (repetir audio). Ignora cuando el foco
 * está en un input/textarea. Debe llamarse en el nivel superior del componente
 * (antes de cualquier return condicional).
 */
export function useLessonKeys({
  onEnter,
  onSelect,
  onReplay,
  enabled = true,
}: LessonKeysOptions) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable)
      ) {
        return;
      }
      // Ctrl/Cmd + Espacio → repetir audio
      if ((e.ctrlKey || e.metaKey) && (e.code === "Space" || e.key === " ")) {
        if (onReplay) {
          e.preventDefault();
          onReplay();
        }
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Enter") {
        if (onEnter) {
          e.preventDefault();
          onEnter();
        }
        return;
      }
      if (/^[1-9]$/.test(e.key)) {
        if (onSelect) {
          e.preventDefault();
          onSelect(Number(e.key) - 1);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onEnter, onSelect, onReplay, enabled]);
}
