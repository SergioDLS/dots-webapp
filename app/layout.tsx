import type { Metadata, Viewport } from "next";
import { Baloo_2, Geist_Mono, Nunito } from "next/font/google";
import "./themes.generated.css";
import "./globals.css";
import { AuthProvider } from "@/context/auth-context";
import AuthSync from "@/context/auth-sync";
import SwRegister from "@/components/pwa/sw-register";
import { THEME_COLORS } from "@/lib/theme-colors";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const baloo = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "dots — Aprende inglés jugando",
  description:
    "Aprende inglés de verdad con Doty: lecciones cortas, rachas y juegos que enganchan.",
  // Esto NO es lo que activa el modo standalone en iOS: desde Safari 15.4,
  // iOS ya lee el `display` del manifest (app/manifest.ts) igual que
  // Android, así que ese modo lo da el manifest, no appleWebApp.capable.
  // Next 16 emite `mobile-web-app-capable` para `capable: true` (no
  // `apple-mobile-web-app-capable`, que es el nombre viejo). Lo que iOS sí
  // ignora del manifest es `orientation` y los `icons` — por eso sigue
  // haciendo falta app/apple-icon.png.
  appleWebApp: {
    capable: true,
    title: "dots",
    statusBarStyle: "default",
    // iOS tampoco lee el splash del manifest: exige un PNG por tamaño físico
    // de pantalla y lo elige con estas media queries. La lista debe quedar
    // idéntica a DEVICES en scripts/mj/compose-splash.mjs — añadir un
    // dispositivo son los dos sitios, o el `<link>` apunta a un 404.
    startupImage: (
      [
        [375, 667, 2], [414, 896, 2], [414, 896, 3], [375, 812, 3],
        [390, 844, 3], [393, 852, 3], [402, 874, 3], [430, 932, 3],
        [440, 956, 3], [768, 1024, 2], [820, 1180, 2], [1024, 1366, 2],
      ] as const
    ).map(([w, h, dpr]) => ({
      url: `/splash/splash-${w}x${h}@${dpr}x.png`,
      media:
        `(device-width: ${w}px) and (device-height: ${h}px) and ` +
        `(-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)`,
    })),
  },
};

// viewportFit: "cover" activa env(safe-area-inset-*) en iOS: sin él los
// paddings safe-area de la app (nav del hub, teclados de juegos, footers de
// lección) evalúan a 0 y el contenido queda bajo el home indicator en la PWA
// instalada. PROHIBIDO añadir themeColor aquí: la única fuente de
// <meta name="theme-color"> es el script anti-flash de abajo (ver su
// comentario y la saga que lo explica).
export const viewport: Viewport = {
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/*
          Aplica la paleta y el modo guardados ANTES del primer paint (evita
          flash) y deja exactamente una <meta name="theme-color">
          autoritativa, sin `media`. El `viewport` exportado arriba define
          SOLO viewportFit — jamás themeColor: React no gestiona ninguna
          <meta name="theme-color"> propia, así que no hay hidratación que
          pueda reclamar la etiqueta de este script ni recrear una segunda
          con media query. El borrado defensivo (querySelectorAll + remove
          antes de insertar) no es por eso — es solo para que el script siga
          siendo idempotente si llegara a ejecutarse más de una vez. Si
          necesitas reintroducir `viewport.themeColor`, vuelve a leer por qué
          se quitó antes de hacerlo (commit que simplificó esto).

          Los colores salen de THEME_COLORS (lib/theme-colors.ts), GENERADO
          por scripts/themes/build.mjs desde design/themes.json (npm run
          themes:build) — no lo reescribas a mano. Es un mapa
          paleta → modo → --background; la misma constante que usan
          app/manifest.ts y components/theme-toggle.tsx.

          Paleta: "dots-palette" en localStorage; si no hay una guardada o no
          existe en THEME_COLORS, cae a "rosa". Modo: "dots-theme" vale
          "light" o "dark" — quien lo tenga guardado conserva su modo tal
          cual. Cualquier otro valor, incluido no tener nada guardado, es
          modo Auto: NO se fija `data-theme` en <html>, y
          app/themes.generated.css resuelve el tema por
          `prefers-color-scheme` — este script hace la misma resolución aquí
          para elegir el color de la meta y la clase `dark`. Antes, sin nada
          guardado, el modo por defecto era "light" a secas; ahora es Auto.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;var C=${JSON.stringify(THEME_COLORS)};var p=localStorage.getItem("dots-palette");if(!Object.prototype.hasOwnProperty.call(C,p))p="rosa";var m=localStorage.getItem("dots-theme");if(m!=="light"&&m!=="dark")m="auto";d.setAttribute("data-palette",p);if(m==="auto"){d.removeAttribute("data-theme");}else{d.setAttribute("data-theme",m);}var r=m==="auto"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):m;d.classList.toggle("dark",r==="dark");d.style.colorScheme=r;var olds=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<olds.length;i++)olds[i].remove();var t=document.createElement("meta");t.setAttribute("name","theme-color");t.setAttribute("content",C[p][r]);document.head.appendChild(t);}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className={`${nunito.variable} ${baloo.variable} ${geistMono.variable} antialiased`}
      >
        {/* Fuera de AuthProvider a propósito: el SW no depende de la sesión. */}
        <SwRegister />
        <AuthProvider>
          <AuthSync />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
