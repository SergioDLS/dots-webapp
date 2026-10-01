import api from "@/lib/api-client";
import type { CuerpoReporte } from "@/lib/report";

/** Reportes del alumno (spec 2026-10-01 §3.2). El autor lo pone el servidor desde el token. */
export async function createReportService(
  body: CuerpoReporte,
): Promise<{ id: number; merged: boolean }> {
  const { data } = await api.post<{ id: number; merged: boolean }>("/reports", body);
  return data;
}

export type ReportNotice = {
  id: number;
  outcome: "fixed" | "dismissed";
  note: string | null;
  gems: number;
  prompt: string | null;
  resolvedAt: string;
};

/** Resultados aún no vistos. Nunca lanza: un aviso que falla no debe romper el hub. */
export async function getReportNoticesService(): Promise<ReportNotice[]> {
  try {
    const { data } = await api.get<{ notices: ReportNotice[] }>("/me/report-notices");
    return data.notices ?? [];
  } catch {
    return [];
  }
}

export async function markReportNoticesSeenService(ids: number[]): Promise<void> {
  await api.post("/me/report-notices/seen", { ids });
}
