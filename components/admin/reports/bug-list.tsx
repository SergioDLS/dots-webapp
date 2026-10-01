"use client";

import { useState } from "react";

import ContentEditor from "@/components/admin/reports/content-editor";
import ResolveBar from "@/components/admin/reports/resolve-bar";
import {
  ETIQUETA_TIPO,
  cierraAlGuardar,
  esEditable,
  etiquetaMotivoAdmin,
  etiquetaSuperficie,
  fechaCorta,
  mensajeDelServidor,
} from "@/lib/admin-reports";
import { getReportGroup, type AdminBugReport, type AdminReportContent } from "@/services/admin.service";

type ErrorAnotado = { mensaje?: string; origen?: string; hora?: string };
const texto = (v: unknown) => (v == null ? "" : String(v));
const esError = (e: unknown): e is ErrorAnotado => typeof e === "object" && e !== null;

const botonFila =
  "max-w-full break-words rounded-lg border-2 border-(--border) px-2.5 py-1 text-left text-xs font-bold text-(--muted) hover:border-(--accent) hover:text-(--accent) disabled:pointer-events-none disabled:opacity-50";

/**
 * Pestaña Bugs (spec 2026-10-01 §2.4): uno por uno, con el contexto técnico al
 * expandir y, si el reporte señalaba un ejercicio, «Editar» como en el detalle
 * de contenido (§2.5).
 */
export default function BugList({
  bugs,
  flash,
  onCambio,
  onReleer,
}: {
  bugs: AdminBugReport[];
  flash: (text: string, kind?: "ok" | "error") => void;
  /** Se cerró algo: la página resetea y vuelve a pedir la lista (y los contadores). */
  onCambio: () => void;
  /** Se tocó un ejercicio: la página vuelve a pedir la lista SIN vaciarla, para no desmontar el editor. */
  onReleer: () => void;
}) {
  const [abierto, setAbierto] = useState<number | null>(null);
  // «Editar» de un bug con ejercicio: qué reporte está esperando su contenido y el contenido ya cargado.
  const [abriendo, setAbriendo] = useState<number | null>(null);
  const [editor, setEditor] = useState<{ type: string; data: AdminReportContent } | null>(null);

  // El contenido se pide en el toque, no en un efecto (regla 3); el botón queda deshabilitado mientras llega.
  const editar = (r: AdminBugReport) => {
    const { targetType, targetId } = r;
    if (abriendo !== null || !targetType || !targetId || !esEditable(targetType, targetId)) return;
    setAbriendo(r.id);
    getReportGroup(targetType, targetId)
      .then(({ content }) => {
        if (content === null) flash("Este ejercicio ya no existe.", "error");
        else setEditor({ type: targetType, data: content });
      })
      .catch((e: unknown) => flash(mensajeDelServidor(e, "No se pudo abrir el ejercicio."), "error"))
      .finally(() => setAbriendo(null));
  };

  if (bugs.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-(--border) p-8 text-center text-sm font-semibold text-(--muted)">
        Sin fallos reportados. Ojalá siga así.
      </div>
    );
  }

  return (
    <>
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
                  {r.targetType && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-(--accent)/15 px-2 py-0.5 text-[10px] font-extrabold uppercase text-(--accent)">
                        {ETIQUETA_TIPO[r.targetType] ?? r.targetType}
                      </span>
                      {esEditable(r.targetType, r.targetId) && (
                        <button type="button" className={botonFila} disabled={abriendo !== null} onClick={() => editar(r)}>
                          {abriendo === r.id ? "Abriendo…" : "Editar"}
                        </button>
                      )}
                      {r.targetType === "false_friend" && (
                        <span className="text-xs font-semibold text-(--muted)">
                          Falso amigo fijo en el código (FALSE_FRIENDS en games.service.ts): se arregla en el backend.
                        </span>
                      )}
                    </div>
                  )}
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
      {editor && (
        <ContentEditor
          type={editor.type}
          data={editor.data}
          // Igual que en GroupDetail: al cerrar se vuelve a leer siempre (el studio de voz de la
          // oración publica tomas sin pasar por «Guardar»).
          onClose={() => {
            setEditor(null);
            onReleer();
          }}
          onSaved={(m) => {
            flash(m);
            if (cierraAlGuardar(editor.type)) setEditor(null);
            onReleer();
          }}
        />
      )}
    </>
  );
}
