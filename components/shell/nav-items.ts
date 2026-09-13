import type { IconName } from "@/components/ui/icon";

/** Destinos de la navegación principal (barra inferior móvil + riel desktop). */
export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/levels", label: "Camino", icon: "camino" },
  { href: "/review", label: "Repaso", icon: "repaso" },
  { href: "/quests", label: "Retos", icon: "retos" },
  { href: "/play", label: "Juegos", icon: "juegos" },
  { href: "/profile", label: "Perfil", icon: "perfil" },
];
