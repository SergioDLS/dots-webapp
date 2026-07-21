import React from "react";

import AppNav from "@/components/shell/app-nav";
import AppHeader from "@/components/shell/app-header";

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
    <div className="min-h-screen md:pl-[84px]">
      <AppNav />
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-4 md:px-8 md:pb-12">
        {children}
      </main>
    </div>
  );
}
