import React from "react";

import AppNav from "@/components/shell/app-nav";
import AppHeader from "@/components/shell/app-header";
import FirstRunGate from "@/components/first-run/first-run-gate";
import DotyEntrada from "@/components/ui/doty/doty-entrada";
import ThemeSync from "@/components/theme/theme-sync";
import TipsController from "@/components/tips/tips-controller";
import RivalWatch from "@/components/rival/rival-watch";
import InstallWatch from "@/components/pwa/install-watch";

/**
 * Chrome persistente de las pantallas "hub" (camino, repaso, retos, zona de
 * juego, perfil): riel de iconos en desktop + barra inferior en móvil + HUD.
 * Los flujos inmersivos (lecciones, práctica, checkpoint, onboarding, juegos)
 * viven fuera de este route-group y no heredan el chrome.
 */
export default function HubLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-svh md:pl-[84px]">
      {/* Reconcilia paleta/modo con /me/settings tras el primer paint. */}
      <ThemeSync />
      {/* Primer inicio (spec §7.1): manda a /welcome a quien no tiene
          onboarded_at. No envuelve nada: pinta null y decide en un efecto. */}
      <FirstRunGate />
      {/* Overlay de entrada a la app. Va en el layout y no en /levels porque
          este se monta una vez por carga de página y sobrevive al cambio de
          pestañas: dentro de /levels reaparecería al volver al Camino desde
          Juegos. Se autodestruye tras reproducirse y no renderiza nada si el
          login no dejó nada que reproducir. */}
      <DotyEntrada />
      {/* Pistas contextuales (spec §7.3): espera a que el primer inicio esté
          resuelto y a que el overlay de entrada se haya ido. */}
      <TipsController />
      {/* Aviso "te pasó" (spec §6.5): reacciona a la ruta y solo en Camino,
          Juegos y Retos. No bloquea nada: no es un modal. */}
      <RivalWatch />
      {/* Invitación a instalar la PWA: solo en móvil, solo al volver de
          terminar algo y dos veces como mucho en la vida del dispositivo. */}
      <InstallWatch />
      <AppNav />
      <AppHeader />
      {/* El hueco inferior es la barra de nav (58 px) más un respiro, y suma
          el inset del home indicator porque la barra también lo suma: con el
          `pb-24` plano de antes, un iPhone con notch dejaba 4 px de holgura
          —el contenido casi pisaba la nav— y un Android sin inset se comía
          38 px de vacío que obligaban a scrollear para ver el último bloque. */}
      <main className="mx-auto w-full max-w-5xl px-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] pt-4 md:px-8 md:pb-12">
        {children}
      </main>
    </div>
  );
}
