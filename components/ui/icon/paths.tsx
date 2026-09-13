import type { ReactNode } from "react";

/**
 * Geometría de los iconos de dots. Único sitio del repo donde vive un `path`.
 *
 * El contorno usa `currentColor` a propósito: el nav tiñe el destino activo y
 * el nodo del Camino se apaga al bloquearse. Con un PNG eso obligaría a dos
 * archivos por estado. Los rellenos van fijos en la paleta porque son
 * identidad, no estado.
 *
 * El lienzo mide 0 0 48 48 en todos, y el grosor constante DENTRO de cada familia:
 * nav 3, nodo 2.5, glifo 3.5. No se copia el grosor de los tiles de la fase 2
 * (1.8% del sujeto): a 24 px serían 0.45 px y no se verían.
 */
export const ICON_PATHS = {
  // ── familia nav · stroke-width 3 ──────────────────────────────────────────
  camino: (
    <g fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 41c0-9 24-9 24-18S24 14 24 7" stroke="#35D8F5" />
      <circle cx="12" cy="41" r="4" fill="#FF1F8F" />
      <circle cx="24" cy="7" r="4" fill="#FF1F8F" />
    </g>
  ),
  repaso: (
    <g fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M40 24A16 16 0 1 1 24 8" stroke="#3768FF" />
      <polygon points="24,2 40,10 27,17" fill="#FF1F8F" />
    </g>
  ),
  retos: (
    <g fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="24" cy="24" r="19" fill="#FF1F8F" />
      <circle cx="24" cy="24" r="12" fill="#ffffff" />
      <circle cx="24" cy="24" r="5" fill="#35D8F5" />
    </g>
  ),
  juegos: (
    <g fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="14" width="40" height="20" rx="10" fill="#FF1F8F" />
      <rect x="11" y="17" width="6" height="14" rx="1.5" fill="#ffffff" stroke="none" />
      <rect x="7" y="21" width="14" height="6" rx="1.5" fill="#ffffff" stroke="none" />
      <circle cx="32" cy="29" r="3.5" fill="#35D8F5" stroke="none" />
      <circle cx="38" cy="21" r="3.5" fill="#35D8F5" stroke="none" />
    </g>
  ),
  perfil: (
    <g fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 44A18 18 0 0 1 42 44Z" fill="#35D8F5" />
      <circle cx="24" cy="17" r="9" fill="#FF1F8F" />
    </g>
  ),
} as const satisfies Record<string, ReactNode>;

export type IconName = keyof typeof ICON_PATHS;
