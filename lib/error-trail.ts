/**
 * Los últimos errores de la app, en memoria, para adjuntarlos a un reporte de
 * «Algo no funciona» (spec 2026-10-01 §6). Puro: el enganche a `window` vive
 * en components/report/error-trail-capture.tsx.
 */
export type ErrorAnotado = { mensaje: string; origen?: string; hora: string };

export function crearRastro(max = 5) {
  let lista: ErrorAnotado[] = [];
  return {
    anotar(e: { mensaje: string; origen?: string }, ahora: Date = new Date()): void {
      const mensaje = String(e.mensaje ?? "")
        .slice(0, 200)
        .replace(/[\ud800-\udbff]$/, "");
      if (!mensaje) return;
      const origen = e.origen
        ? e.origen.slice(0, 150).replace(/[\ud800-\udbff]$/, "")
        : undefined;
      lista = [...lista, { mensaje, ...(origen ? { origen } : {}), hora: ahora.toISOString() }].slice(-max);
    },
    leer(): ErrorAnotado[] {
      return [...lista];
    },
  };
}

export const rastroDeErrores = crearRastro();
