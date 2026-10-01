"use client";

import { ETIQUETA_TIPO, etiquetaSuperficie, fechaCorta, resumenMotivos } from "@/lib/admin-reports";
import type { AdminReportGroup } from "@/services/admin.service";

/** Pestaña Contenido (spec 2026-10-01 §2.2): un renglón por ejercicio reportado. */
export default function GroupList({
  grupos,
  onAbrir,
}: {
  grupos: AdminReportGroup[];
  onAbrir: (type: string, id: string) => void;
}) {
  if (grupos.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-(--border) p-8 text-center text-sm font-semibold text-(--muted)">
        Nada por aquí. Cuando un alumno reporte un ejercicio, aparece en esta lista.
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {grupos.map((g) => (
        <li key={`${g.type}:${g.id}`}>
          <button
            type="button"
            onClick={() => onAbrir(g.type, g.id)}
            className="flex w-full flex-col gap-1.5 rounded-2xl border-2 border-(--border) bg-(--surface) px-4 py-3 text-left transition-colors hover:border-(--accent)"
          >
            <span className="line-clamp-2 break-words font-display text-base font-extrabold text-foreground">
              {g.prompt || "(sin texto)"}
            </span>
            <span className="flex flex-wrap items-center gap-2 text-xs font-bold text-(--muted)">
              <span className="rounded-full bg-(--accent)/15 px-2 py-0.5 text-[10px] font-extrabold uppercase text-(--accent)">
                {ETIQUETA_TIPO[g.type] ?? g.type}
              </span>
              <span>{etiquetaSuperficie(g.surface)}</span>
              {g.where && <span>· {g.where}</span>}
            </span>
            <span className="text-sm font-semibold text-foreground">{resumenMotivos(g.reasons)}</span>
            <span className="text-xs font-semibold text-(--muted)">
              {g.students} {g.students === 1 ? "alumno" : "alumnos"} · último {fechaCorta(g.lastAt)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
