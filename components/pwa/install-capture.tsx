"use client";

import { useEffect } from "react";

import { arrancarCaptura } from "@/lib/install-browser";

/**
 * Engancha el `beforeinstallprompt` de Chromium en cuanto la página vive.
 *
 * Va en el layout RAÍZ, al lado de SwRegister y fuera de AuthProvider: el
 * evento no depende de la sesión y llega mucho antes de que el usuario
 * navegue a ninguna parte. Montarlo dentro del hub llegaría tarde —el evento
 * no se repite— y el botón "Instalar" no aparecería nunca en Android.
 *
 * No pinta nada. Toda la decisión de enseñar algo es de
 * `components/pwa/install-watch.tsx`.
 */
export default function InstallCapture() {
  useEffect(() => {
    arrancarCaptura();
  }, []);
  return null;
}
