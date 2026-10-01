"use client";

import { useEffect, useState } from "react";

import Spinner from "@/components/ui/Spinner/Spinner";
import UIButton from "@/components/ui/button/button";
import { Icon } from "@/components/ui/icon";
import ContentEditor, { cambiarEncendido, tieneInterruptor } from "@/components/admin/reports/content-editor";
import ResolveBar from "@/components/admin/reports/resolve-bar";
import {
  ETIQUETA_TIPO,
  alternativaPara,
  camposVisibles,
  cierraAlGuardar,
  etiquetaModo,
  etiquetaMotivoAdmin,
  etiquetaSuperficie,
  fechaCorta,
  idsACerrar,
  idsPendientes,
  mensajeDelServidor,
  notaPorDefecto,
  puedeAceptar,
} from "@/lib/admin-reports";
import {
  createAnswerAlternative,
  deleteAnswerAlternative,
  getReportGroup,
  type AdminReportAnswer,
  type AdminReportGroupDetail,
} from "@/services/admin.service";

/** Detalle de un ejercicio reportado (spec 2026-10-01 §2.3): contenido de ahora, respuestas, reportes y cierre. */
export default function GroupDetail({
  type,
  id,
  flash,
  onVolver,
}: {
  type: string;
  id: string;
  flash: (text: string, kind?: "ok" | "error") => void;
  onVolver: () => void;
}) {
  const [detalle, setDetalle] = useState<AdminReportGroupDetail | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [fetchAttempt, setFetchAttempt] = useState(0);
  const [marcados, setMarcados] = useState<number[] | null>(null); // null = todos los pendientes
  const [nota, setNota] = useState("");
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    let vivo = true;
    getReportGroup(type, id)
      .then((d) => {
        if (vivo) setDetalle(d);
      })
      .catch(() => {
        if (vivo) setLoadError(true);
      });
    return () => {
      vivo = false;
    };
  }, [type, id, fetchAttempt]);

  // Recargar por evento (patrón fetchAttempt, regla 3): el handler resetea y bumpea.
  // La nota también: «Ahora «feel» también vale» es de los reportes que se acaban de
  // cerrar, no de los que sigan pendientes (sin esto el siguiente cierre la mandaría
  // a alumnos que respondieron otra cosa).
  const recargar = () => {
    setLoadError(false);
    setDetalle(null);
    setMarcados(null);
    setNota("");
    setFetchAttempt((n) => n + 1);
  };

  if (loadError) {
    return (
      <div className="flex flex-col items-start gap-3">
        <button type="button" onClick={onVolver} className="text-sm font-extrabold text-(--accent)">
          ← Volver a reportes
        </button>
        <div className="rounded-2xl border-2 border-(--danger)/30 bg-(--danger)/10 p-4 text-sm font-bold text-(--danger)">
          No se pudo cargar este reporte.
        </div>
        <UIButton onClick={recargar}>Reintentar</UIButton>
      </div>
    );
  }
  if (!detalle) {
    return (
      <div className="py-16">
        <Spinner title="Cargando el reporte…" />
      </div>
    );
  }

  const pendientes = idsPendientes(detalle.reports);
  // `marcados` sobrevive a las relecturas en el sitio: solo cuenta (y se manda) lo que sigue pendiente.
  const seleccion = idsACerrar(marcados, pendientes);
  const contenido = detalle.content;

  const aceptar = (r: AdminReportAnswer) => {
    const alt = alternativaPara(type, r);
    if (!alt) return;
    createAnswerAlternative({
      targetType: alt.targetType,
      targetId: id,
      kind: alt.kind,
      value: r.answer,
      sourceReportId: r.reportIds[0],
    })
      .then(() => {
        flash(notaPorDefecto(r.answer));
        setMarcados(r.reportIds.filter((rid) => pendientes.includes(rid)));
        setNota(notaPorDefecto(r.answer));
        setFetchAttempt((n) => n + 1);
      })
      .catch((e: unknown) => flash(mensajeDelServidor(e, "No se pudo aceptar la respuesta."), "error"));
  };

  const quitar = (altId: number) => {
    deleteAnswerAlternative(altId)
      .then(({ deleted }) => {
        // `deleted: false` = ya no estaba (otro admin la quitó): se dice, no se finge.
        flash(deleted ? "Respuesta quitada." : "Esa respuesta ya no estaba.");
        setFetchAttempt((n) => n + 1);
      })
      .catch((e: unknown) => flash(mensajeDelServidor(e, "No se pudo quitar."), "error"));
  };

  const alternar = (rid: number) =>
    setMarcados((prev) => {
      const base = prev ?? pendientes;
      return base.includes(rid) ? base.filter((x) => x !== rid) : [...base, rid];
    });

  const chip = "rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase";
  const botonFila =
    "max-w-full break-words rounded-lg border-2 border-(--border) px-2.5 py-1 text-left text-xs font-bold text-(--muted) hover:border-(--accent) hover:text-(--accent)";
  const encendido = contenido?.content.enabled === true;

  const alternarEncendido = () =>
    cambiarEncendido(type, Number(id), !encendido)
      .then(() => {
        flash(encendido ? "Ejercicio apagado." : "Ejercicio encendido.");
        setFetchAttempt((n) => n + 1);
      })
      .catch(() => flash("No se pudo cambiar.", "error"));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <button type="button" onClick={onVolver} className="w-fit text-sm font-extrabold text-(--accent)">
          ← Volver a reportes
        </button>
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-(--muted)">
          <span className={`${chip} bg-(--accent)/15 text-(--accent)`}>{ETIQUETA_TIPO[type] ?? type}</span>
          {detalle.where && <span>{detalle.where}</span>}
        </div>
        <h1 className="break-words font-display text-xl font-extrabold text-foreground">{detalle.prompt || "(sin texto)"}</h1>
      </div>

      <section className="flex flex-col gap-3 rounded-2xl border-2 border-(--border) bg-(--surface) p-4">
        <h2 className="text-xs font-extrabold uppercase tracking-widest text-(--muted)">Así está ahora</h2>
        {contenido === null ? (
          <p className="text-sm font-semibold text-(--muted)">
            {type === "false_friend"
              ? "Falso amigo fijo en el código (FALSE_FRIENDS en games.service.ts): se arregla en el backend."
              : "Este contenido ya no existe; queda la foto que mandó el alumno."}
          </p>
        ) : (
          <>
            <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {camposVisibles(type, contenido.content).map((c) => (
                <div key={c.label} className="flex flex-col">
                  <dt className="text-xs font-bold text-(--muted)">{c.label}</dt>
                  <dd className="break-words text-sm font-semibold text-foreground">{c.value}</dd>
                </div>
              ))}
            </dl>
            {contenido.parentLabel && (
              <p className="text-xs font-semibold text-(--muted)">Vive en {contenido.parentLabel}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" className={botonFila} onClick={() => setEditando(true)}>
                Editar
              </button>
              {tieneInterruptor(type, contenido.content) && (
                <button type="button" className={botonFila} onClick={alternarEncendido}>
                  {encendido ? "Apagar" : "Encender"}
                </button>
              )}
            </div>
          </>
        )}
      </section>

      {detalle.answers.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-extrabold uppercase tracking-widest text-(--muted)">Lo que respondieron</h2>
          <ul className="flex flex-col gap-2">
            {detalle.answers.map((r) => (
              <li
                key={`${r.kind}:${r.answer}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-(--surface) px-4 py-3"
              >
                <span className="min-w-0 break-words text-sm font-semibold text-foreground">
                  «{r.answer}» · {r.count} {r.count === 1 ? "alumno" : "alumnos"}
                </span>
                {puedeAceptar(type) && alternativaPara(type, r) && (
                  <button type="button" className={botonFila} onClick={() => aceptar(r)}>
                    Aceptar «{r.answer}»
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {puedeAceptar(type) && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-extrabold uppercase tracking-widest text-(--muted)">Respuestas que ya valen</h2>
          {detalle.alternatives.length === 0 ? (
            <p className="text-sm font-semibold text-(--muted)">Todavía ninguna.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {detalle.alternatives.map((a) => (
                <li
                  key={a.id}
                  className="flex max-w-full items-center gap-2 rounded-full bg-(--accent)/15 px-3 py-1 text-xs font-bold text-(--accent)"
                >
                  <span className="min-w-0 break-words">{a.value}</span>
                  <span className="text-(--muted)">· {a.kind === "word" ? "palabra" : "orden"}</span>
                  <button type="button" onClick={() => quitar(a.id)} className="font-black underline">
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-extrabold uppercase tracking-widest text-(--muted)">
          Reportes ({detalle.reports.length})
        </h2>
        <ul className="flex flex-col gap-2">
          {detalle.reports.map((r) => {
            const pendiente = r.status === "pending";
            const on = seleccion.includes(r.id);
            return (
              <li key={r.id} className="flex gap-3 rounded-2xl border-2 border-(--border) bg-(--surface) px-4 py-3">
                {pendiente ? (
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    aria-label={`Incluir el reporte de ${r.userName}`}
                    onClick={() => alternar(r.id)}
                    className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md"
                    style={{
                      background: on ? "var(--accent)" : "transparent",
                      border: on ? "none" : "2px solid var(--border)",
                      color: "var(--accent-contrast)",
                    }}
                  >
                    {on && <Icon name="check" size={14} mono />}
                  </button>
                ) : (
                  <span
                    className={`${chip} h-fit ${
                      r.status === "fixed" ? "bg-(--success)/15 text-(--success)" : "bg-(--muted)/15 text-(--muted)"
                    }`}
                  >
                    {r.status === "fixed" ? "Arreglado" : "Descartado"}
                  </span>
                )}
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2 break-words text-sm font-extrabold text-foreground">
                    {r.userName}
                    {r.isAdmin && <span className={`${chip} bg-(--purple)/15 text-(--purple)`}>admin</span>}
                    <span className="text-xs font-semibold text-(--muted)">{fechaCorta(r.createdAt)}</span>
                  </span>
                  <span className="text-xs font-bold text-(--muted)">
                    {r.reasons.map(etiquetaMotivoAdmin).join(" · ")} — {etiquetaSuperficie(r.surface)}
                    {r.mode ? ` · ${etiquetaModo(r.mode)}` : ""}
                  </span>
                  {r.answer && (
                    <span className="break-words text-sm font-semibold text-foreground">
                      Respondió «{r.answer}»{r.expected ? `, se esperaba «${r.expected}»` : ""}
                    </span>
                  )}
                  {r.comment && <span className="break-words text-sm text-foreground">«{r.comment}»</span>}
                  {!pendiente && r.note && (
                    <span className="break-words text-xs font-semibold text-(--muted)">Nota: {r.note}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {pendientes.length > 0 && (
        <ResolveBar key={nota} ids={seleccion} notaInicial={nota} flash={flash} onResuelto={recargar} />
      )}

      {editando && contenido && (
        <ContentEditor
          type={type}
          data={contenido}
          // Al cerrar se vuelve a leer siempre: hay cambios que no pasan por «Guardar»
          // (el studio de voz de la oración publica tomas por su cuenta).
          onClose={() => {
            setEditando(false);
            setFetchAttempt((n) => n + 1);
          }}
          onSaved={(m) => {
            flash(m);
            // La oración sigue abierta tras guardar, como en Levels (ver cierraAlGuardar);
            // los demás modales se cierran.
            if (cierraAlGuardar(type)) setEditando(false);
            setFetchAttempt((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}
