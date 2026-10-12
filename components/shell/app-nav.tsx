"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { NAV_ITEMS } from "./nav-items";
import { getChallengesService } from "@/services/challenges.service";
import { useAuth } from "@/context/auth-context";
import { Icon } from "@/components/ui/icon";

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

/** Puntito con contador para el tab Retos cuando hay retos 1v1 por jugar. */
function ChallengeBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      aria-label={`${count} retos pendientes`}
      className="absolute -top-1 -right-1 grid min-w-4 h-4 place-items-center rounded-full px-1 text-[9px] font-black leading-none"
      style={{
        background: "var(--accent)",
        color: "var(--accent-contrast, #fff)",
      }}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

/**
 * Navegación principal del hub: riel de iconos a la izquierda en desktop,
 * barra inferior fija en móvil. Mismo conjunto de destinos en ambos.
 */
export default function AppNav() {
  const pathname = usePathname() || "";

  // Retos 1v1 entrantes → badge en el tab Retos. Fetch único en cuanto hay
  // sesión (resiliente: 0 si no la hay); una leve obsolescencia es aceptable.
  const [incomingCount, setIncomingCount] = useState(0);
  const { isBootstrapping, accessToken } = useAuth();

  useEffect(() => {
    if (isBootstrapping || !accessToken) return;
    let active = true;
    getChallengesService().then((data) => {
      if (active) setIncomingCount(data.incoming.length);
    });
    return () => {
      active = false;
    };
  }, [isBootstrapping, accessToken]);

  const badgeFor = (href: string) =>
    href === "/quests" ? <ChallengeBadge count={incomingCount} /> : null;

  return (
    <>
      {/* ── Riel desktop ─────────────────────────────────────── */}
      <nav
        aria-label="Navegación principal"
        className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:z-40 md:w-[84px] md:items-center md:gap-1 md:border-r md:border-(--border) md:bg-(--surface) md:py-5 md:ps-[env(safe-area-inset-left)]"
      >
        {/* La marca, y de paso el atajo a inicio. Es el MISMO icono que la PWA
            instalada y el favicon, que es lo que lo hace reconocible: una "d"
            suelta en un cuadrado no se leía como logo. `icon-192` y no el
            maskable porque solo ese trae transparencia — el maskable lleva
            fondo sólido a propósito y aquí pintaría un cuadro claro sobre el
            tema oscuro. El alt va vacío porque el enlace ya se anuncia. */}
        <Link
          href="/levels"
          aria-label="dots — inicio"
          className="mb-4 grid h-11 w-11 place-items-center"
        >
          <Image
            src="/icons/icon-192.png"
            alt=""
            width={44}
            height={44}
            priority
            className="h-11 w-11"
          />
        </Link>
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex w-[68px] flex-col items-center gap-1 rounded-2xl px-1 py-2.5 transition-colors duration-150 ${
                active
                  ? "bg-(--accent)/12 text-(--accent)"
                  : "text-(--muted) hover:bg-(--accent)/8 hover:text-(--accent)"
              }`}
            >
              <span className="relative leading-none">
                <Icon name={item.icon} size={24} />
                {badgeFor(item.href)}
              </span>
              <span className="text-[10px] font-extrabold tracking-wide">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* ── Barra inferior móvil ─────────────────────────────── */}
      {/* Solo iconos: el rótulo se comía casi la mitad del alto de la barra.
          El icono ocupa ese hueco (40 px en vez de 24) y la barra mide lo
          mismo que antes, 57 px. Sin rótulo, el color del contorno era la
          única pista de dónde estás, así que el activo lleva además la
          pastilla del riel de escritorio. El nombre sigue en `sr-only`: es
          el nombre accesible del enlace. */}
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-(--border) bg-(--surface) pb-[env(safe-area-inset-bottom)] ps-[env(safe-area-inset-left)] pe-[env(safe-area-inset-right)] md:hidden"
      >
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`grid place-items-center py-1 transition-colors duration-150 ${
                active ? "text-(--accent)" : "text-(--muted)"
              }`}
            >
              <span
                className={`rounded-2xl px-2.5 py-1 transition-colors duration-150 ${
                  active ? "bg-(--accent)/12" : ""
                }`}
              >
                <span className="relative block">
                  <Icon name={item.icon} size={40} className="block" />
                  {badgeFor(item.href)}
                </span>
              </span>
              <span className="sr-only">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
