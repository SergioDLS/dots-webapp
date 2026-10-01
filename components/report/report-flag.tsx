"use client";

import { useCallback, useState } from "react";

import ReportSheet from "@/components/report/report-sheet";
import { Icon } from "@/components/ui/icon";
import { useCandidatosReporte } from "@/hooks/use-report-targets";
import type { ReportTarget } from "@/lib/report";

/**
 * La banderita (spec 2026-10-01 §1.1). Sin props lee lo que la pantalla
 * publicó en lib/report-targets.ts; con `objetivos`, usa esos. Congela la
 * lista al abrir: si la pantalla avanza sola, la hoja no cambia bajo el dedo.
 * El área táctil (46 px) es mayor que el glifo, como el lápiz del perfil.
 */
export default function ReportFlag({ objetivos }: { objetivos?: ReportTarget[] }) {
  const publicados = useCandidatosReporte();
  const lista = objetivos ?? publicados;
  const [abierta, setAbierta] = useState<ReportTarget[] | null>(null);
  const cerrar = useCallback(() => setAbierta(null), []);

  return (
    <>
      {lista.length > 0 && (
        <button
          type="button"
          onClick={() => setAbierta(lista)}
          aria-label="Reportar un problema"
          className="relative shrink-0 rounded-full p-1.5 text-(--muted) transition-transform duration-150 before:absolute before:-inset-1.5 before:content-[''] active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
        >
          <Icon name="bandera" size={22} />
        </button>
      )}
      {abierta && <ReportSheet candidatos={abierta} onCerrar={cerrar} />}
    </>
  );
}
