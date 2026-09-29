"use client";

import { useCallback, useState } from "react";

import { useAdminMode } from "@/hooks/use-admin-mode";
import AdminLabSheet from "./admin-lab-sheet";

/**
 * Recordatorio permanente de que lo que ves NO es lo que ve un alumno (spec
 * modo admin 2026-09-29). Solo con la lente encendida y confirmada por el
 * servidor. Fondo púrpura y texto `--primary-contrast` (blanco, salvo en
 * Eléctrico oscuro, donde el púrpura es cian): nada de navy como relleno
 * (regla 11), sin icono ni Doty dentro. Abre la caja de herramientas.
 *
 * Cuelga del borde inferior del HUD (posición absoluta respecto al header
 * sticky) y no ocupa sitio en la fila: para un alumno, y para el admin con la
 * lente apagada, la fila queda idéntica; con ella encendida, la barra de XP
 * no se estrecha en pantallas de 375 px.
 */
export default function AdminPill() {
  const { encendido } = useAdminMode();
  const [open, setOpen] = useState(false);
  const cerrar = useCallback(() => setOpen(false), []);

  if (!encendido) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Modo admin: abrir herramientas"
        className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 rounded-b-xl px-2.5 py-0.5 text-[10px] font-black tracking-widest transition-transform before:absolute before:-inset-2 before:content-[''] active:scale-95"
        style={{
          background: "var(--purple)",
          color: "var(--primary-contrast)",
          boxShadow: "0 2px 0 var(--purple-edge)",
        }}
      >
        ADMIN
      </button>
      <AdminLabSheet open={open} onClose={cerrar} />
    </>
  );
}
