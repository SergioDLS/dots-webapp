"use client";

import { useCallback, useState } from "react";

import { useAdminMode } from "@/hooks/use-admin-mode";
import { useReportCounts } from "@/hooks/use-report-counts";
import { totalPendientes } from "@/lib/report-counts";
import AdminLabSheet from "./admin-lab-sheet";

/**
 * Recordatorio permanente de que lo que ves NO es lo que ve un alumno (spec
 * modo admin 2026-09-29). Solo con la lente encendida y confirmada por el
 * servidor. Fondo púrpura y texto `--primary-contrast` (blanco, salvo en
 * Eléctrico oscuro, donde el púrpura es cian): nada de navy como relleno
 * (regla 11), sin icono ni Doty dentro. Abre la caja de herramientas.
 *
 * Vive dentro de la fila del HUD, junto a la barra de XP. En móvil ocupa el
 * lugar del texto «x/y XP», que el HUD oculta mientras la lente está
 * encendida: la barra no se estrecha y nada cuelga sobre la cabecera plegable
 * del Camino. En escritorio caben los dos. Para un alumno, y para el admin con
 * la lente apagada, la fila queda idéntica.
 *
 * Con reportes pendientes (spec reportes 2026-10-01 §2.1) lleva un puntito: el
 * admin se entera por los contadores (este, Ajustes y el panel), no por correo.
 */
export default function AdminPill() {
  const { encendido } = useAdminMode();
  // Antes del `return null` (reglas de los hooks); un alumno o un admin con la
  // lente apagada (`encendido` false) no pide nada.
  const pendientes = totalPendientes(useReportCounts(encendido));
  const [open, setOpen] = useState(false);
  const cerrar = useCallback(() => setOpen(false), []);

  if (!encendido) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Modo admin: abrir herramientas${
          pendientes > 0
            ? ` · ${pendientes} ${pendientes === 1 ? "reporte pendiente" : "reportes pendientes"}`
            : ""
        }`}
        className="relative shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black tracking-widest transition-transform before:absolute before:-inset-2 before:content-[''] active:scale-95"
        style={{
          background: "var(--purple)",
          color: "var(--primary-contrast)",
          boxShadow: "0 2px 0 var(--purple-edge)",
        }}
      >
        ADMIN
        {pendientes > 0 && (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full"
            style={{ background: "var(--danger)" }}
          />
        )}
      </button>
      <AdminLabSheet open={open} onClose={cerrar} />
    </>
  );
}
