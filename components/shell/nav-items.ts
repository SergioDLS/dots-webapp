/** Destinos de la navegación principal (barra inferior móvil + riel desktop). */
export type NavItem = {
  href: string;
  label: string;
  /** emoji provisional; se puede sustituir por icono más adelante */
  icon: string;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/levels", label: "Camino", icon: "🛤️" },
  { href: "/review", label: "Repaso", icon: "🔁" },
  { href: "/quests", label: "Retos", icon: "🎯" },
  { href: "/play", label: "Juegos", icon: "🎮" },
  { href: "/profile", label: "Perfil", icon: "👤" },
];
