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
 *
 * Los márgenes negativos dejan su caja de layout en 22×14 px —el ancho del
 * glifo y el alto de la barra de progreso— mientras el círculo de 34 px y el
 * área de 46 px siguen igual: aparecer no agranda la tarjeta de la barra ni
 * empuja el ejercicio. Con `-m-1.5` a secas la barra sin racha ni corazones
 * crecía 8 px (42 → 50). Pide una fila flex con `items-center`.
 *
 * `reservar` pinta, mientras no hay nada que reportar, un hueco vacío de esa
 * misma caja de 22×14 px: la banderita aparece cuando un efecto publica y, sin
 * el hueco, lo que comparte fila con ella cambiaba al aparecer (la pista de la
 * barra de progreso se encogía 34 px: 22 más el gap).
 */
export default function ReportFlag({
  objetivos,
  reservar = false,
}: {
  objetivos?: ReportTarget[];
  reservar?: boolean;
}) {
  const publicados = useCandidatosReporte();
  const lista = objetivos ?? publicados;
  const [abierta, setAbierta] = useState<ReportTarget[] | null>(null);
  const cerrar = useCallback(() => setAbierta(null), []);

  return (
    <>
      {lista.length > 0 ? (
        <button
          type="button"
          onClick={() => setAbierta(lista)}
          aria-label="Reportar un problema"
          className="relative -mx-1.5 -my-2.5 shrink-0 rounded-full p-1.5 text-(--muted) transition-transform duration-150 before:absolute before:-inset-1.5 before:content-[''] active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
        >
          <Icon name="bandera" size={22} />
        </button>
      ) : (
        reservar && <span aria-hidden className="h-3.5 w-5.5 shrink-0" />
      )}
      {abierta && <ReportSheet candidatos={abierta} onCerrar={cerrar} />}
    </>
  );
}
