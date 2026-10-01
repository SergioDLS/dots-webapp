"use client";

import { useEffect, useSyncExternalStore } from "react";

import type { ReportTarget } from "@/lib/report";
import {
  leerCandidatos,
  limpiarObjetivos,
  publicarObjetivos,
  suscribirObjetivos,
} from "@/lib/report-targets";

const NINGUNO: ReportTarget[] = [];

/**
 * La pantalla publica lo que tiene delante y lo retira al desmontarse.
 * Publicar desde el efecto escribe en un store externo, no en un setState:
 * no rompe la regla 3. Pasa la lista memoizada; si no, igual no hay bucle
 * porque el store compara firmas.
 */
export function usePublicarObjetivos(lista: readonly ReportTarget[] | null): void {
  // `null` = esta pantalla no publica ahora (p. ej. el padre mientras un hijo
  // tiene el ejercicio): no pisa lo que el hijo publicó.
  useEffect(() => {
    if (lista) publicarObjetivos(lista);
  }, [lista]);
  useEffect(() => () => limpiarObjetivos(), []);
}

export function useCandidatosReporte(): ReportTarget[] {
  return useSyncExternalStore(suscribirObjetivos, leerCandidatos, () => NINGUNO);
}
