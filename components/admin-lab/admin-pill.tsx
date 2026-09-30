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
 * Vive dentro de la fila del HUD, junto a la barra de XP. En móvil ocupa el
 * lugar del texto «x/y XP», que el HUD oculta mientras la lente está
 * encendida: la barra no se estrecha y nada cuelga sobre la cabecera plegable
 * del Camino. En escritorio caben los dos. Para un alumno, y para el admin con
 * la lente apagada, la fila queda idéntica.
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
        className="relative shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black tracking-widest transition-transform before:absolute before:-inset-2 before:content-[''] active:scale-95"
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
