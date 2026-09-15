import type { MetadataRoute } from "next";
import { THEME_COLORS } from "@/lib/theme-colors";

/**
 * Manifest de la PWA. Next lo sirve en `/manifest.webmanifest` y le inyecta
 * su `<link rel="manifest">` solo por existir este archivo — no hay que
 * enlazarlo a mano en el layout.
 *
 * El service worker vive en public/sw.js (lo registra
 * components/pwa/sw-register.tsx): offline de cortesía y cache de estáticos,
 * nunca HTML ni API. El push del SO sigue delegado a la futura app React
 * Native (ver docs/superpowers/specs/2026-08-16-pwa-manifest-design.md).
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
    // vienen de THEME_COLORS (lib/theme-colors.ts, GENERADO desde
    // design/themes.json) para no divergir del script anti-flash de
    // app/layout.tsx ni de components/profile/settings-sheet.tsx.
    // Nota: este manifest es estático — no puede leer la paleta ni el modo
    // guardados en localStorage, así que splash y barra siempre salen en
    // Rosa claro (ver docs/superpowers/specs/2026-08-16-pwa-manifest-design.md).
    background_color: THEME_COLORS.rosa.light,
    theme_color: THEME_COLORS.rosa.light,
    lang: "es",
    dir: "ltr",
    categories: ["education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Lo que Chromium muestra en el prompt de instalación. Se rehacen con
    // scripts/mj/capture-screenshots.sh cuando la UI cambia — y son PÚBLICAS,
    // así que ninguna sale de /profile ni de /quests: llevan la foto y el
    // nombre del usuario.
    screenshots: [
      {
        src: "/screenshots/camino-narrow.png",
        sizes: "390x844",
        type: "image/png",
        form_factor: "narrow",
        label: "El Camino: niveles y lecciones",
      },
      {
        src: "/screenshots/juegos-narrow.png",
        sizes: "390x844",
        type: "image/png",
        form_factor: "narrow",
        label: "12 juegos para practicar",
      },
      {
        src: "/screenshots/leccion-narrow.png",
        sizes: "390x844",
        type: "image/png",
        form_factor: "narrow",
        label: "Lecciones cortas con Doty",
      },
      {
        src: "/screenshots/camino-wide.png",
        sizes: "1280x800",
        type: "image/png",
        form_factor: "wide",
        label: "El Camino en escritorio",
      },
    ],
    // Accesos del long-press (Android) / click derecho (desktop). Solo
    // Chromium; iOS los ignora. Las etiquetas replican las tabs del hub.
    shortcuts: [
      {
        name: "Camino",
        url: "/levels",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Juegos",
        url: "/play",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Repaso",
        url: "/review",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
    // En desktop instalado reutiliza la ventana existente en vez de abrir
    // otra; donde no está soportado se ignora sin efecto.
    launch_handler: { client_mode: ["navigate-existing", "auto"] },
  };
}
