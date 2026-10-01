"use client";

import { useEffect, useSyncExternalStore } from "react";

import {
  fijarConteo,
  leerConteo,
  sigueVigente,
  suscribirConteo,
  versionConteo,
  type ConteoReportes,
} from "@/lib/report-counts";
import { getReportSummary } from "@/services/admin.service";

/**
 * Una sola petición por versión aunque lo monten Ajustes, el chip y el panel a
 * la vez. Y solo mientras sea reciente (`sigueVigente`, 2 minutos): el efecto de
 * abajo no se repite por sí solo, así que sin esto una PWA abierta horas serviría
 * a cada montaje el conteo del primero. Coste: como mucho una GET por montaje, y
 * solo si la anterior tiene 2 minutos o más (o si cambió la versión).
 */
let enCurso: { version: number; at: number; promesa: Promise<void> } | null = null;

function pedir(version: number): Promise<void> {
  const ahora = Date.now();
  if (enCurso && sigueVigente(enCurso, version, ahora)) return enCurso.promesa;
  const promesa = getReportSummary()
    .then(fijarConteo)
    .catch(() => {}); // sin conteo no hay puntito; nada se rompe
  enCurso = { version, at: ahora, promesa };
  return promesa;
}

/** Solo para admins (`activo`): un alumno nunca pide /admin/*. */
export function useReportCounts(activo: boolean): ConteoReportes | null {
  const version = useSyncExternalStore(suscribirConteo, versionConteo, () => 0);
  const conteo = useSyncExternalStore(suscribirConteo, leerConteo, () => null);
  useEffect(() => {
    if (!activo) return;
    void pedir(version); // escribe en el store externo, no hace setState
  }, [activo, version]);
  return activo ? conteo : null;
}
