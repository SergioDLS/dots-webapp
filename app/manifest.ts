import type { MetadataRoute } from "next";
import { THEME_COLORS } from "@/lib/theme-colors";

/**
 * Manifest de la PWA. Next lo sirve en `/manifest.webmanifest` y le inyecta
 * su `<link rel="manifest">` solo por existir este archivo — no hay que
 * enlazarlo a mano en el layout.
 *
 * Sin service worker a propósito: esta tanda hace la app INSTALABLE, no
 * offline. El push sigue delegado a la futura app React Native (ver
 * docs/superpowers/specs/2026-08-16-pwa-manifest-design.md).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "dots — Aprende inglés jugando",
    short_name: "dots",
    description:
      "Aprende inglés de verdad con Doty: lecciones cortas, rachas y juegos que enganchan.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // Los 12 juegos están compuestos en columna (HUD arriba, controles abajo)
    // y ninguno aprovecha el horizontal. OJO: esto solo ata a la app YA
    // INSTALADA; en el navegador se sigue pudiendo girar.
    orientation: "portrait",
    // El fondo, no el rosa de marca: el theme_color tiñe la barra de estado y
    // un acento ahí se lee como una cabecera que la app no tiene. Ambos
    // vienen de THEME_COLORS (lib/theme-colors.ts) para no divergir del
    // script anti-flash de app/layout.tsx ni de components/theme-toggle.tsx.
    // Nota: este manifest es estático — no puede leer el tema guardado en
    // localStorage, así que splash y barra siempre salen en claro (ver
    // docs/superpowers/specs/2026-08-16-pwa-manifest-design.md).
    background_color: THEME_COLORS.light,
    theme_color: THEME_COLORS.light,
    lang: "es",
    dir: "ltr",
    categories: ["education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
