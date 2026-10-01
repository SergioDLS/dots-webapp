"use client";

import { useEffect } from "react";

import { rastroDeErrores } from "@/lib/error-trail";

/** Anota los errores de la app para los reportes de «Algo no funciona». No pinta nada. */
export default function ErrorTrailCapture() {
  useEffect(() => {
    const alError = (e: ErrorEvent) =>
      rastroDeErrores.anotar({
        mensaje: e.message,
        origen: e.filename ? `${e.filename}:${e.lineno}` : undefined,
      });
    const alRechazo = (e: PromiseRejectionEvent) =>
      rastroDeErrores.anotar({
        mensaje: e.reason instanceof Error ? e.reason.message : String(e.reason),
      });
    window.addEventListener("error", alError);
    window.addEventListener("unhandledrejection", alRechazo);
    return () => {
      window.removeEventListener("error", alError);
      window.removeEventListener("unhandledrejection", alRechazo);
    };
  }, []);
  return null;
}
