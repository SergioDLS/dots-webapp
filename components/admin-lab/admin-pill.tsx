"use client";

import { useState } from "react";

import { useAdminMode } from "@/hooks/use-admin-mode";
import AdminLabSheet from "./admin-lab-sheet";

/**
 * Recordatorio permanente de que lo que ves NO es lo que ve un alumno (spec
 * modo admin 2026-09-29). Solo con la lente encendida y confirmada por el
 * servidor. Fondo púrpura y texto blanco: nada de navy como relleno (regla
 * 11), sin icono ni Doty dentro. Abre la caja de herramientas.
 */
export default function AdminPill() {
  const { encendido } = useAdminMode();
  const [open, setOpen] = useState(false);

  if (!encendido) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Modo admin: abrir herramientas"
        className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black tracking-widest text-white transition-transform active:scale-95"
        style={{ background: "var(--purple)", boxShadow: "0 2px 0 var(--purple-edge)" }}
      >
        ADMIN
      </button>
      <AdminLabSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
