import type { Metadata } from "next";
import { Baloo_2, Geist_Mono, Nunito } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/auth-context";
import AuthSync from "@/context/auth-sync";
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
  },
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
          Aplica el tema guardado ANTES del primer paint (evita flash) y deja
          exactamente una <meta name="theme-color"> autoritativa, sin `media`.
          No existe `viewport.themeColor` en este layout: React no gestiona
          ninguna <meta name="theme-color"> propia, así que no hay hidratación
          que pueda reclamar la etiqueta de este script ni recrear una
          segunda con media query. El borrado defensivo (querySelectorAll +
          remove antes de insertar) no es por eso — es solo para que el
          script siga siendo idempotente si llegara a ejecutarse más de una
          vez. Si necesitas reintroducir `viewport.themeColor`, vuelve a leer
          por qué se quitó antes de hacerlo (commit que simplificó esto).
          Los dos colores se interpolan desde THEME_COLORS
          (lib/theme-colors.ts), la misma constante que usan app/manifest.ts
          y components/theme-toggle.tsx — no los reescribas a mano aquí.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("dots-theme")||"light";document.documentElement.setAttribute("data-theme",t);if(t==="dark")document.documentElement.classList.add("dark");document.documentElement.style.colorScheme=t;var olds=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<olds.length;i++)olds[i].remove();var m=document.createElement("meta");m.setAttribute("name","theme-color");m.setAttribute("content",t==="dark"?"${THEME_COLORS.dark}":"${THEME_COLORS.light}");document.head.appendChild(m);}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className={`${nunito.variable} ${baloo.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <AuthSync />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
