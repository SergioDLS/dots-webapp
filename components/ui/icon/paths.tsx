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

  // ── familia glifo · stroke-width 3.5 ──────────────────────────────────────
  check: (
    <path d="M9,25 L19,35 L39,12" fill="none" stroke="currentColor" strokeWidth={3.5} />
  ),
  cruz: (
    <path d="M13,13 L35,35 M35,13 L13,35" fill="none" stroke="currentColor" strokeWidth={3.5} />
  ),
  aviso: (
    <g fill="none" stroke="currentColor" strokeWidth={3.5}>
      <path d="M26,10 L42,37 Q44,41 39,41 L9,41 Q4,41 6,37 L22,10 Q24,6 26,10 Z" fill="#35D8F5" />
      <rect x="21.5" y="17" width="5" height="13" rx="2.5" fill="#ffffff" stroke="none" />
      <circle cx="24" cy="34" r="3" fill="#ffffff" stroke="none" />
    </g>
  ),
  candado: (
    <g fill="none" stroke="currentColor" strokeWidth={3.5}>
      <path d="M16,21 V15 A8,8 0 0 1 32,15 V21" />
      <rect x="9" y="21" width="30" height="21" rx="4" fill="#FF1F8F" />
    </g>
  ),
  lupa: (
    <g fill="none" stroke="currentColor" strokeWidth={3.5}>
      <circle cx="21" cy="21" r="13" />
      <path d="M30,30 L41,41" />
    </g>
  ),
  lapiz: (
    <g fill="none" stroke="currentColor" strokeWidth={3.5}>
      <g transform="rotate(40 24 24)">
        <rect x="19" y="4" width="10" height="26" rx="2" fill="#FF1F8F" />
        <path d="M19,30 L29,30 L24,43 Z" />
      </g>
    </g>
  ),
  ajustes: (
    <path
      d="M16,3 L32,3 L32,16 L45,16 L45,32 L32,32 L32,45 L16,45 L16,32 L3,32 L3,16 L16,16 Z M18,24 a6,6 0 1,0 12,0 a6,6 0 1,0 -12,0"
      fill="#3768FF"
      fillRule="evenodd"
      stroke="currentColor"
      strokeWidth={3.5}
    />
  ),
  enlace: (
    <g fill="none" stroke="currentColor" strokeWidth={3.5}>
      <path
        d="M8,24 a11,6 0 1,0 22,0 a11,6 0 1,0 -22,0 M12,24 a7,2.2 0 1,0 14,0 a7,2.2 0 1,0 -14,0"
        fill="#FF1F8F"
        fillRule="evenodd"
        stroke="none"
        transform="rotate(-30 19 24)"
      />
      <path
        d="M18,24 a11,6 0 1,0 22,0 a11,6 0 1,0 -22,0 M22,24 a7,2.2 0 1,0 14,0 a7,2.2 0 1,0 -14,0"
        fill="#35D8F5"
        fillRule="evenodd"
        stroke="none"
        transform="rotate(30 29 24)"
      />
    </g>
  ),
  abajo: (
    <path d="M24,6 V30 M12,22 L24,34 L36,22" fill="none" stroke="currentColor" strokeWidth={3.5} />
  ),
  sol: (
    <g fill="none" stroke="currentColor" strokeWidth={3.5}>
      <circle cx="24" cy="24" r="8" fill="#FF1F8F" />
      <path d="M24,13 L24,7 M33.5,18.5 L38.7,15.5 M33.5,29.5 L38.7,32.5 M24,35 L24,41 M14.5,29.5 L9.3,32.5 M14.5,18.5 L9.3,15.5" />
    </g>
  ),
  luna: (
    <path
      d="M35.39,28.24 A15,15 0 1,1 20.03,9.03 A13,13 0 0,0 35.39,28.24 Z"
      fill="#3768FF"
      stroke="currentColor"
      strokeWidth={3.5}
    />
  ),
  imagen: (
    <g fill="none" stroke="currentColor" strokeWidth={3.5}>
      <rect x="5" y="7" width="38" height="34" rx="4" />
      <path d="M9,36 L19,18 L27,30 L33,21 L40,36 Z" fill="#35D8F5" stroke="none" />
    </g>
  ),
  calendario: (
    <g fill="none" stroke="currentColor" strokeWidth={3.5}>
      <rect x="6" y="10" width="36" height="32" rx="4" />
      <rect x="7" y="11" width="34" height="9" fill="#FF1F8F" stroke="none" />
      <path d="M24,20 V42 M6,31 H42" />
    </g>
  ),
  punto: (
    <circle cx="24" cy="24" r="14" fill="#35D8F5" stroke="currentColor" strokeWidth={3.5} />
  ),
  cuadro: (
    <rect x="10" y="10" width="28" height="28" rx="7" fill="#3768FF" stroke="currentColor" strokeWidth={3.5} />
  ),
  obras: (
    <g fill="none" stroke="currentColor" strokeWidth={3.5}>
      <path d="M13,28 L8,41 M35,28 L40,41" />
      <rect x="6" y="16" width="12" height="12" fill="#FF1F8F" stroke="none" />
      <rect x="18" y="16" width="12" height="12" fill="#ffffff" stroke="none" />
      <rect x="30" y="16" width="12" height="12" fill="#FF1F8F" stroke="none" />
      <rect x="6" y="16" width="36" height="12" rx="2" />
    </g>
  ),
  empate: (
    <g fill="none" stroke="currentColor" strokeWidth={3.5}>
      <rect x="10" y="16" width="28" height="7" rx="2" fill="#FF1F8F" />
      <rect x="10" y="27" width="28" height="7" rx="2" fill="#35D8F5" />
    </g>
  ),
} as const satisfies Record<string, ReactNode>;

export type IconName = keyof typeof ICON_PATHS;
