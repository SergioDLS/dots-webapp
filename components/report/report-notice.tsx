"use client";

import { useEffect, useRef } from "react";

import Doty from "@/components/ui/doty/doty";
import UIButton from "@/components/ui/button/button";
import OverlayPortal from "@/components/ui/overlay-portal";
import { UiIcon } from "@/components/ui/ui-icon";
import { resumenDeAvisos } from "@/lib/report-notice";
import { bloquearScroll } from "@/lib/scroll-lock";
import type { ReportNotice as Aviso } from "@/services/reports.service";

/**
 * «Arreglamos lo que reportaste» (spec 2026-10-01 §1.6). Es un diálogo de
 * verdad: toma el scroll, así que pistas, aviso de rival e invitación a
 * instalar esperan a que se cierre. No se va solo: se cierra con «¡Genial!».
 */
export default function ReportNotice({ avisos, onCerrar }: { avisos: Aviso[]; onCerrar: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const resumen = resumenDeAvisos(avisos);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    document.addEventListener("keydown", alTeclear);
    const soltar = bloquearScroll();
    return () => {
      document.removeEventListener("keydown", alTeclear);
      soltar();
    };
  }, [onCerrar]);

  if (!resumen) return null;

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
        <div aria-hidden onClick={onCerrar} className="absolute inset-0" style={{ background: "var(--scrim)" }} />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="aviso-reporte-titulo"
          tabIndex={-1}
          className="relative z-10 flex max-h-[88svh] w-full flex-col items-center gap-3 overflow-y-auto rounded-t-3xl bg-(--surface) px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-6 text-center [animation:dots-slide-up_.28s_ease-out_both] md:max-w-md md:rounded-3xl md:pb-6"
        >
          <Doty pose={resumen.pose} size="small" animation="bob" />
          <h2 id="aviso-reporte-titulo" className="font-display text-xl font-extrabold text-foreground">
            {resumen.titulo}
          </h2>
          <ul className="flex w-full flex-col gap-2 text-left">
            {resumen.lineas.map((l) => (
              <li key={l.id} className="flex flex-col gap-1 rounded-2xl px-4 py-3" style={{ background: "var(--surface-2)" }}>
                <span className="flex items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-black uppercase tracking-wide"
                    style={{
                      background: l.arreglado
                        ? "color-mix(in srgb, var(--success) 16%, transparent)"
                        : "color-mix(in srgb, var(--muted) 14%, transparent)",
                      color: l.arreglado ? "var(--success)" : "var(--muted)",
                    }}
                  >
                    {l.arreglado ? "Arreglado" : "Revisado"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-extrabold text-foreground">{l.texto}</span>
                </span>
                {l.nota && <span className="text-xs font-semibold text-(--muted)">{l.nota}</span>}
              </li>
            ))}
          </ul>
          {resumen.extra > 0 && <p className="text-xs font-bold text-(--muted)">y {resumen.extra} más</p>}
          {resumen.gemas > 0 && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-black"
              style={{
                background: "color-mix(in srgb, var(--gem) 16%, transparent)",
                border: "2px solid color-mix(in srgb, var(--gem) 40%, transparent)",
                color: "var(--gem)",
              }}
            >
              <UiIcon name="gemas" size={18} /> +{resumen.gemas} por ayudarnos
            </span>
          )}
          <div className="mt-1 w-full">
            <UIButton tone="accent" onClick={onCerrar} fullWidth>
              ¡Genial!
            </UIButton>
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
}
