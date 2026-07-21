"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_ITEMS } from "./nav-items";

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * Navegación principal del hub: riel de iconos a la izquierda en desktop,
 * barra inferior fija en móvil. Mismo conjunto de destinos en ambos.
 */
export default function AppNav() {
  const pathname = usePathname() || "";

  return (
    <>
      {/* ── Riel desktop ─────────────────────────────────────── */}
      <nav
        aria-label="Navegación principal"
        className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:z-40 md:w-[84px] md:items-center md:gap-1 md:border-r md:border-(--border) md:bg-(--surface) md:py-5"
      >
        <Link
          href="/levels"
          aria-label="dots — inicio"
          className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-(--accent) text-lg font-black text-(--accent-contrast)"
        >
          d
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
              <span className="text-2xl leading-none">{item.icon}</span>
              <span className="text-[10px] font-extrabold tracking-wide">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* ── Barra inferior móvil ─────────────────────────────── */}
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-(--border) bg-(--surface) pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 transition-colors duration-150 ${
                active ? "text-(--accent)" : "text-(--muted)"
              }`}
            >
              <span className="text-xl leading-none">{item.icon}</span>
              <span className="text-[10px] font-extrabold tracking-tight">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
