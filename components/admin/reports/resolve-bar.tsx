"use client";

import { useState } from "react";

import UIButton from "@/components/ui/button/button";
import { modalInputCls } from "@/components/admin/ui";
import { mensajeDelServidor } from "@/lib/admin-reports";
import { refrescarConteoReportes } from "@/lib/report-counts";
import { resolveReports } from "@/services/admin.service";

/** Cerrar uno o varios reportes con nota opcional para el alumno (spec §2.3). */
export default function ResolveBar({
  ids,
  notaInicial = "",
  flash,
  onResuelto,
}: {
  ids: number[];
  notaInicial?: string;
  flash: (text: string, kind?: "ok" | "error") => void;
  onResuelto: () => void;
}) {
  const [nota, setNota] = useState(notaInicial);
  const [enviando, setEnviando] = useState(false);

  const cerrar = (outcome: "fixed" | "dismissed") => {
    if (ids.length === 0 || enviando) return;
    setEnviando(true);
    resolveReports(ids, outcome, nota.trim() || undefined)
      .then(({ resolved, gems }) => {
        flash(
          outcome === "fixed"
            ? `${resolved} arreglado${resolved === 1 ? "" : "s"} · ${gems} gemas repartidas`
            : `${resolved} descartado${resolved === 1 ? "" : "s"}`,
        );
        refrescarConteoReportes();
        onResuelto();
      })
      .catch((e: unknown) => flash(mensajeDelServidor(e, "No se pudo cerrar. Inténtalo otra vez."), "error"))
      .finally(() => setEnviando(false));
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-(--border) bg-(--surface) p-4">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-bold uppercase tracking-widest text-(--muted)">
          Nota para el alumno (opcional)
        </span>
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder="Ej.: «am» es la única que va con I"
          className={modalInputCls}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <UIButton tone="accent" onClick={() => cerrar("fixed")} disabled={enviando || ids.length === 0}>
          Arreglado ({ids.length})
        </UIButton>
        <UIButton tone="neutral" onClick={() => cerrar("dismissed")} disabled={enviando || ids.length === 0}>
          Descartar
        </UIButton>
      </div>
    </div>
  );
}
