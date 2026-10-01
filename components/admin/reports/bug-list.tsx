"use client";

import { useState } from "react";

import ResolveBar from "@/components/admin/reports/resolve-bar";
import { etiquetaMotivoAdmin, etiquetaSuperficie, fechaCorta } from "@/lib/admin-reports";
import type { AdminBugReport } from "@/services/admin.service";

type ErrorAnotado = { mensaje?: string; origen?: string; hora?: string };
const texto = (v: unknown) => (v == null ? "" : String(v));
const esError = (e: unknown): e is ErrorAnotado => typeof e === "object" && e !== null;

/** Pestaña Bugs (spec 2026-10-01 §2.4): uno por uno, con el contexto técnico al expandir. */
export default function BugList({
  bugs,
  flash,
  onCambio,
}: {
  bugs: AdminBugReport[];
  flash: (text: string, kind?: "ok" | "error") => void;
  onCambio: () => void;
}) {
  const [abierto, setAbierto] = useState<number | null>(null);

  if (bugs.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-(--border) p-8 text-center text-sm font-semibold text-(--muted)">
        Sin fallos reportados. Ojalá siga así.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {bugs.map((r) => {
        const expandido = abierto === r.id;
        const ctx = r.context;
        // `context` lo manda el alumno: un elemento que no sea objeto no debe tumbar la bandeja.
        const errores = Array.isArray(ctx.errores) ? ctx.errores.filter(esError) : [];
        const lugar = texto(ctx.lugar);
        const foto = typeof r.snapshot.prompt === "string" ? r.snapshot.prompt : "";
        const tecnico: Array<[string, unknown]> = [
          ["Ruta", ctx.route],
          ["Navegador", ctx.ua],
          ["Pantalla", ctx.viewport],
          ["Instalada", ctx.standalone === true ? "sí" : "no"],
          ["Versión", ctx.build],
        ];
        return (
          <li key={r.id} className="rounded-2xl border-2 border-(--border) bg-(--surface)">
            <button
              type="button"
              onClick={() => setAbierto(expandido ? null : r.id)}
              aria-expanded={expandido}
              className="flex w-full flex-col gap-1 px-4 py-3 text-left"
            >
              <span className="flex flex-wrap items-center gap-2 text-sm font-extrabold text-foreground">
                {r.userName}
                {r.isAdmin && (
                  <span className="rounded-full bg-(--purple)/15 px-2 py-0.5 text-[10px] font-extrabold uppercase text-(--purple)">
                    admin
                  </span>
                )}
                <span className="text-xs font-semibold text-(--muted)">{fechaCorta(r.createdAt)}</span>
              </span>
              <span className="break-words text-xs font-bold text-(--muted)">
                {etiquetaSuperficie(r.surface)}
                {lugar ? ` · ${lugar}` : ""}
                {r.where ? ` · ${r.where}` : ""} — {r.reasons.map(etiquetaMotivoAdmin).join(" · ")}
              </span>
              {r.comment && <span className="break-words text-sm text-foreground">«{r.comment}»</span>}
            </button>
            {expandido && (
              <div className="flex flex-col gap-3 border-t-2 border-(--border) px-4 py-3">
                <dl className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
                  {tecnico.map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <dt className="font-bold text-(--muted)">{k}</dt>
                      <dd className="min-w-0 break-words font-semibold text-foreground">{texto(v)}</dd>
                    </div>
                  ))}
                </dl>
                {foto && <p className="break-words text-sm font-semibold text-foreground">Lo que veía: «{foto}»</p>}
                {errores.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-bold uppercase tracking-widest text-(--muted)">Últimos errores</span>
                    <ul className="flex flex-col gap-1 font-mono text-[11px] text-foreground">
                      {errores.map((e, i) => (
                        <li key={i} className="break-words">
                          {texto(e.hora).slice(11, 19)} · {texto(e.mensaje)}
                          {e.origen ? ` · ${e.origen}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {r.status === "pending" ? (
                  <ResolveBar ids={[r.id]} flash={flash} onResuelto={onCambio} />
                ) : (
                  <p className="text-xs font-semibold text-(--muted)">
                    {r.status === "fixed" ? "Arreglado" : "Descartado"}
                    {r.note ? ` · ${r.note}` : ""}
                  </p>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
