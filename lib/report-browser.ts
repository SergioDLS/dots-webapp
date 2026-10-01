import { rastroDeErrores } from "@/lib/error-trail";

/**
 * Lo que viaja en `context` de todo reporte (spec 2026-10-01 §6). Solo se
 * llama desde un handler (al enviar), nunca en render: lee `window` y
 * `matchMedia` sin riesgo de hidratación. La ruta la pasa quien llama
 * (usePathname), para no leer `window.location`.
 */
export function contextoTecnico(ruta: string, conErrores: boolean): Record<string, unknown> {
  if (typeof window === "undefined") return { route: ruta };
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return {
    route: ruta,
    ua: navigator.userAgent.slice(0, 300),
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    standalone,
    build: (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "dev").slice(0, 7),
    ...(conErrores ? { errores: rastroDeErrores.leer() } : {}),
  };
}
