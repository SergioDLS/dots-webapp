import type { Metadata, Viewport } from "next";
import { Baloo_2, Geist_Mono, Nunito } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/auth-context";
import AuthSync from "@/context/auth-sync";

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
  // iOS ignora el manifest: la instalación desde "Añadir a pantalla de inicio"
  // se configura con estos metadatos y con app/apple-icon.png
  appleWebApp: {
    capable: true,
    title: "dots",
    statusBarStyle: "default",
  },
};

/**
 * Respaldo sin JS. El color de verdad lo fija el script del <head>, porque el
 * tema de esta app lo manda `localStorage["dots-theme"]`, no el esquema del
 * sistema: sin esa segunda capa, quien tenga el SO en oscuro y la app en claro
 * vería la barra de estado oscura sobre una app clara.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fff7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#14122e" },
  ],
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
          El export `viewport` de arriba declara dos <meta theme-color> con
          media query (el respaldo sin JS); este script las reemplaza por una
          sola. El MutationObserver existe porque React 19 hidrata esas dos
          <meta> del `viewport` buscando en el DOM por (name+content) —sin
          mirar `media`— y si no encuentra una que matchee exactamente,
          crea una nueva con su `media` original intacto. Como este script
          deja una sola etiqueta con el content del tema activo, React
          reclama esa y crea de cero la otra mitad estática justo después de
          hidratar: sin el observer reaparecería una segunda etiqueta con
          `media`, el defecto exacto que este mecanismo debía impedir.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("dots-theme")||"light";document.documentElement.setAttribute("data-theme",t);if(t==="dark")document.documentElement.classList.add("dark");document.documentElement.style.colorScheme=t;var want=function(){return document.documentElement.getAttribute("data-theme")==="dark"?"#14122e":"#fff7fb";};var sync=function(){var olds=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<olds.length;i++)olds[i].remove();var m=document.createElement("meta");m.setAttribute("name","theme-color");m.setAttribute("content",want());document.head.appendChild(m);};sync();if(window.MutationObserver&&!window.__dotsThemeObs){window.__dotsThemeObs=new MutationObserver(function(){var tags=document.querySelectorAll('meta[name="theme-color"]');if(tags.length!==1||tags[0].getAttribute("media")||tags[0].getAttribute("content")!==want())sync();});window.__dotsThemeObs.observe(document.head,{childList:true});}}catch(e){}})();`,
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
