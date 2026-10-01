"use client";

import { useCallback, useState } from "react";

import ReportSheet from "@/components/report/report-sheet";
import UIButton from "@/components/ui/button/button";
import { Icon } from "@/components/ui/icon";
import {
  objetivoGeneral,
  ordenarParaJuego,
  type ReportSurface,
  type ReportTarget,
} from "@/lib/report";

/**
 * «Reportar un problema» al final de una partida (spec 2026-10-01 §1.5): los
 * ítems de la ronda, primero los fallados, y al final «El juego en general».
 */
export default function ReportButton({
  objetivos,
  surface,
}: {
  objetivos: readonly ReportTarget[];
  surface: ReportSurface;
}) {
  const [abierta, setAbierta] = useState<ReportTarget[] | null>(null);
  const cerrar = useCallback(() => setAbierta(null), []);
  return (
    <>
      <UIButton
        tone="ghost"
        fullWidth
        onClick={() =>
          setAbierta([...ordenarParaJuego(objetivos), objetivoGeneral(surface, "El juego en general")])
        }
      >
        <span className="inline-flex items-center gap-2">
          <Icon name="bandera" size={18} />
          Reportar un problema
        </span>
      </UIButton>
      {abierta && <ReportSheet candidatos={abierta} onCerrar={cerrar} />}
    </>
  );
}
