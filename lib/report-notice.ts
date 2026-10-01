import { recortar } from "./report.ts";
import type { ReportNotice } from "@/services/reports.service";

/**
 * El aviso de vuelta (spec 2026-10-01 §1.6): qué dice la hoja cuando el admin
 * cerró reportes del alumno. Puro; las gemas ya se sumaron en el servidor.
 *
 * `recortar` es el de lib/report.ts, no uno propio: corta por unidades UTF-16
 * pero descarta la media pareja de sustitutos si el corte cae en un emoji.
 */
export const MAX_LINEAS = 3;

export type LineaAviso = { id: number; texto: string; nota: string | null; arreglado: boolean };

export type ResumenAvisos = {
  pose: "aplaudiendo" | "pensando";
  titulo: string;
  lineas: LineaAviso[];
  extra: number;
  gemas: number;
};

export function resumenDeAvisos(avisos: readonly ReportNotice[]): ResumenAvisos | null {
  if (avisos.length === 0) return null;
  const arreglados = avisos.filter((a) => a.outcome === "fixed").length;
  const titulo =
    arreglados === 0
      ? avisos.length === 1
        ? "Revisamos tu reporte"
        : `Revisamos tus ${avisos.length} reportes`
      : arreglados === 1
        ? "¡Arreglamos lo que reportaste!"
        : `¡Arreglamos ${arreglados} cosas que reportaste!`;
  return {
    pose: arreglados > 0 ? "aplaudiendo" : "pensando",
    titulo,
    lineas: avisos.slice(0, MAX_LINEAS).map((a) => ({
      id: a.id,
      texto: a.prompt ? `«${recortar(a.prompt, 60)}»` : "Un ejercicio",
      nota: a.note,
      arreglado: a.outcome === "fixed",
    })),
    extra: Math.max(0, avisos.length - MAX_LINEAS),
    gemas: avisos.reduce((total, a) => total + (a.gems ?? 0), 0),
  };
}
