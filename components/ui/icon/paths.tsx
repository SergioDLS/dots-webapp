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
      <path d="M40 24A16 16 0 1 1 24 8" stroke="#35D8F5" />
      <polygon points="24,2 37,8 24,14" fill="#FF1F8F" />
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

  // ── familia nodo · stroke-width 2.5 ───────────────────────────────────────
  leccion: (
    <g fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6,16 Q15,9 24,10 Q33,9 42,16 L42,38 Q33,32 24,34 Q15,32 6,38 Z" fill="#FF1F8F" />
      <path d="M9,17 Q16,13 22,14 L22,33 Q16,31 9,34 Z" fill="#ffffff" />
      <path d="M39,17 Q32,13 26,14 L26,33 Q32,31 39,34 Z" fill="#ffffff" />
    </g>
  ),
  escucha: (
    <g fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6,18 L6,30 L13,30 L22,38 L22,10 L13,18 Z" fill="#FF1F8F" />
      <path d="M29,17 a11,11 0 0 1 0,14" stroke="#35D8F5" />
      <path d="M34,11 a19,19 0 0 1 0,26" stroke="#35D8F5" />
    </g>
  ),
  gramatica: (
    <g fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6,10 H24 V19 A5,5 0 0 1 24,29 V38 H6 Z" fill="#FF1F8F" />
      <path d="M24,10 H42 V38 H24 V29 A5,5 0 0 0 24,19 Z" fill="#35D8F5" />
    </g>
  ),
  vocabulario: (
    <g fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12,8 H36 A6,6 0 0 1 42,14 V26 A6,6 0 0 1 36,32 H22 L14,41 L14,32 H12 A6,6 0 0 1 6,26 V14 A6,6 0 0 1 12,8 Z" fill="#ffffff" />
      <circle cx="16" cy="20" r="3" fill="#FF1F8F" stroke="none" />
      <circle cx="24" cy="20" r="3" fill="#35D8F5" stroke="none" />
      <circle cx="32" cy="20" r="3" fill="#3768FF" stroke="none" />
    </g>
  ),
  letras: (
    <g fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="15" width="21" height="21" rx="4" fill="#FF1F8F" transform="rotate(-16 15.5 25.5)" />
      <rect x="22" y="15" width="21" height="21" rx="4" fill="#3768FF" transform="rotate(16 32.5 25.5)" />
      <rect x="14" y="12" width="21" height="21" rx="4" fill="#35D8F5" />
    </g>
  ),
  numeros: (
    <g fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="9" width="36" height="30" rx="5" />
      <path d="M18,9 V39 M30,9 V39" />
      <circle cx="18" cy="18" r="5" fill="#FF1F8F" stroke="none" />
      <circle cx="18" cy="31" r="5" fill="#35D8F5" stroke="none" />
      <circle cx="30" cy="24" r="5" fill="#FF1F8F" stroke="none" />
    </g>
  ),
  lectura: (
    <g fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="16" y="8" width="11" height="32" rx="1.5" fill="#35D8F5" />
      <rect x="29" y="17" width="11" height="23" rx="1.5" fill="#FF1F8F" />
      <rect x="6" y="12" width="10" height="28" rx="1.5" fill="#3768FF" transform="rotate(25 11 40)" />
    </g>
  ),
  checkpoint: (
    <g fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15,7 V41" />
      <polygon points="15,7 40,17 15,27" fill="#FF1F8F" />
    </g>
  ),
} as const satisfies Record<string, ReactNode>;

export type IconName = keyof typeof ICON_PATHS;
