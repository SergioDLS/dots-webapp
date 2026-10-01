"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import Doty from "@/components/ui/doty/doty";
import UIButton from "@/components/ui/button/button";
import OverlayPortal from "@/components/ui/overlay-portal";
import { Icon } from "@/components/ui/icon";
import {
  LUGARES_APP,
  MAX_COMENTARIO,
  cuerpoDelReporte,
  detalleMotivo,
  etiquetaMotivo,
  motivosPara,
  objetivoGeneral,
  validarBorrador,
  type ReportReason,
  type ReportTarget,
} from "@/lib/report";
import { contextoTecnico } from "@/lib/report-browser";
import { bloquearScroll } from "@/lib/scroll-lock";
import { createReportService } from "@/services/reports.service";

interface Props {
  /** Lo que se puede reportar, congelado al abrir. Con más de uno, primero se elige. */
  candidatos: ReportTarget[];
  /** "app": el reporte general de Ajustes, sin ejercicio y con «¿Dónde pasó?». */
  modo?: "ejercicio" | "app";
  /** Estable (useCallback): el efecto de scroll depende de ella. */
  onCerrar: () => void;
}

type Paso = "elegir" | "motivos" | "gracias";

/**
 * La hoja de reporte (spec 2026-10-01 §1.3): «¿sobre cuál?» si hace falta,
 * «¿qué pasó?», comentario y envío. Solo pinta y envía: qué motivos salen, la
 * validación y el cuerpo viven en lib/report.ts. Es un diálogo de verdad
 * —toma el scroll con lib/scroll-lock—, así que pistas y avisos esperan a
 * que se cierre. RN-safe: todo con toques; la caja de comentario no es una
 * entrada para jugar.
 *
 * El teclado se queda dentro: los atajos de la lección (Enter y 1-9, en
 * hooks/use-lesson-keys.ts) cuelgan de window y solo se apartan de
 * input/textarea, así que sin cortar la propagación un Enter sobre una casilla
 * de la hoja avanzaría el ejercicio que hay detrás.
 */
export default function ReportSheet({ candidatos, modo = "ejercicio", onCerrar }: Props) {
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const [elegido, setElegido] = useState<ReportTarget | null>(() =>
    modo === "app"
      ? objetivoGeneral("app", "Reportar un problema")
      : candidatos.length === 1
        ? candidatos[0]
        : null,
  );
  const [paso, setPaso] = useState<Paso>(elegido ? "motivos" : "elegir");
  const [motivos, setMotivos] = useState<ReportReason[]>([]);
  const [comentario, setComentario] = useState("");
  const [lugar, setLugar] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Foco al abrir, en su propio efecto (mismo motivo que install-sheet.tsx).
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  useEffect(() => {
    // En captura y sin propagar: si la hoja se abrió sobre Ajustes, Escape
    // cierra solo esta y no también la de abajo.
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onCerrar();
    };
    document.addEventListener("keydown", alTeclear, true);
    const soltar = bloquearScroll();
    return () => {
      document.removeEventListener("keydown", alTeclear, true);
      soltar();
    };
  }, [onCerrar]);

  const alternar = (m: ReportReason) => {
    setError(null);
    setMotivos((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  };

  const enviar = () => {
    if (!elegido || enviando) return;
    // Solo cuentan los motivos que aplican al objetivo elegido: uno marcado
    // para otro objetivo no se valida ni viaja.
    const motivosValidos = motivos.filter((m) => motivosPara(elegido).includes(m));
    const borrador = { motivos: motivosValidos, comentario, lugar: lugar ?? undefined };
    const invalido = validarBorrador(borrador);
    if (invalido) {
      setError(invalido);
      return;
    }
    setEnviando(true);
    setError(null);
    const conErrores = motivosValidos.includes("bug") || elegido.type === null;
    createReportService(cuerpoDelReporte(elegido, borrador, contextoTecnico(pathname, conErrores)))
      .then(() => setPaso("gracias"))
      .catch((e: unknown) => {
        const status = (e as { response?: { status?: number } })?.response?.status;
        setError(
          status === 429
            ? "Ya mandaste muchos reportes hoy. ¡Gracias! Vuelve mañana."
            : status === 503
              ? "Los reportes aún no están disponibles. Prueba más tarde."
              : "No se pudo enviar. Revisa tu conexión y vuelve a intentarlo.",
        );
      })
      .finally(() => setEnviando(false));
  };

  const fila = (on: boolean) => ({
    background: on ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "var(--surface-2)",
    border: on ? "2px solid var(--accent)" : "2px solid transparent",
  });

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
        <div
          aria-hidden
          onClick={onCerrar}
          className="absolute inset-0"
          style={{ background: "var(--scrim)" }}
        />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="reporte-titulo"
          tabIndex={-1}
          onKeyDown={(e) => e.stopPropagation()}
          className="relative z-10 flex max-h-[88svh] w-full flex-col overflow-y-auto rounded-t-3xl bg-(--surface) px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 [animation:dots-slide-up_.28s_ease-out_both] md:max-w-md md:rounded-3xl md:pb-5"
        >
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="absolute right-4 top-4 rounded-full p-2 text-(--muted) transition-transform duration-150 active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
          >
            <Icon name="cruz" size={18} mono />
          </button>

          {paso === "elegir" && (
            <>
              <h2 id="reporte-titulo" className="pr-10 font-display text-xl font-extrabold text-foreground">
                ¿Sobre cuál ejercicio?
              </h2>
              <div className="mt-4 flex flex-col gap-2">
                {candidatos.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => {
                      setElegido(c);
                      setPaso("motivos");
                    }}
                    className="flex flex-col items-start gap-0.5 rounded-2xl px-4 py-3 text-left transition-transform duration-150 active:scale-[.98]"
                    style={fila(false)}
                  >
                    <span className="text-sm font-extrabold text-foreground">{c.label}</span>
                    {c.answer !== undefined && (
                      <span className="text-xs font-semibold text-(--muted)">Elegiste «{c.answer}»</span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}

          {paso === "motivos" && elegido && (
            <>
              <h2 id="reporte-titulo" className="pr-10 font-display text-xl font-extrabold text-foreground">
                ¿Qué pasó?
              </h2>
              {elegido.type !== null && (
                <p className="mt-1 line-clamp-2 text-sm font-semibold text-(--muted)">{elegido.label}</p>
              )}

              {modo === "app" && (
                <div className="mt-4 flex flex-col gap-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-(--muted)">¿Dónde pasó?</span>
                  <div className="flex flex-wrap gap-2">
                    {LUGARES_APP.map((l) => {
                      const on = lugar === l.clave;
                      return (
                        <button
                          key={l.clave}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setLugar(on ? null : l.clave)}
                          className="rounded-full px-3 py-1.5 text-sm font-extrabold transition-transform duration-150 active:scale-95"
                          style={{ ...fila(on), color: on ? "var(--accent)" : "var(--foreground)" }}
                        >
                          {l.etiqueta}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-col gap-2">
                {motivosPara(elegido).map((m) => {
                  const on = motivos.includes(m);
                  const detalle = detalleMotivo(m, elegido);
                  return (
                    <button
                      key={m}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => alternar(m)}
                      className="flex items-start gap-3 rounded-2xl px-4 py-3 text-left transition-transform duration-150 active:scale-[.98]"
                      style={fila(on)}
                    >
                      <span
                        aria-hidden
                        className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md"
                        style={{
                          background: on ? "var(--accent)" : "transparent",
                          border: on ? "none" : "2px solid var(--border)",
                          color: "var(--accent-contrast)",
                        }}
                      >
                        {on && <Icon name="check" size={14} mono />}
                      </span>
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-sm font-extrabold text-foreground">{etiquetaMotivo(m, elegido)}</span>
                        {detalle && <span className="text-xs font-semibold text-(--muted)">{detalle}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>

              <label className="mt-4 flex flex-col gap-1">
                <span className="text-xs font-bold uppercase tracking-widest text-(--muted)">Cuéntanos más</span>
                <textarea
                  value={comentario}
                  onChange={(e) => {
                    setError(null);
                    setComentario(e.target.value);
                  }}
                  maxLength={MAX_COMENTARIO}
                  rows={3}
                  placeholder={motivos.includes("other") ? "¿Qué viste?" : "Opcional"}
                  className="w-full resize-none rounded-2xl border-2 border-(--border) bg-(--surface-2) px-4 py-3 text-sm font-semibold text-foreground outline-none focus:border-(--accent)"
                />
              </label>

              {error && (
                <p role="alert" className="mt-3 text-sm font-bold text-(--danger)">
                  {error}
                </p>
              )}

              <div className="mt-4">
                <UIButton tone="accent" onClick={enviar} disabled={enviando} fullWidth>
                  {enviando ? "Enviando…" : "Enviar reporte"}
                </UIButton>
              </div>
            </>
          )}

          {paso === "gracias" && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <Doty pose="aplaudiendo" size="small" animation="bob" />
              <h2 id="reporte-titulo" className="font-display text-xl font-extrabold text-foreground">
                ¡Gracias! Lo revisamos
              </h2>
              <p className="text-sm font-semibold text-(--muted)">
                {modo === "app"
                  ? "Si es un fallo, lo vamos a arreglar."
                  : "Sigue con lo tuyo: reportar no gasta vidas ni avance."}
              </p>
              <div className="mt-2 w-full">
                <UIButton tone="accent" onClick={onCerrar} fullWidth>
                  {modo === "app" ? "Listo" : "Volver al ejercicio"}
                </UIButton>
              </div>
            </div>
          )}
        </div>
      </div>
    </OverlayPortal>
  );
}
