"use client";

import { useState } from "react";

import { useAdminMode } from "@/hooks/use-admin-mode";
import { bumpCuenta } from "@/lib/account-refresh";
import { fijarModoAdmin } from "@/lib/admin-mode";
import { setAdminModeService } from "@/services/admin-lab.service";

/**
 * Fila "Modo admin" con switch (mismo control visual que "Sonidos" en la hoja
 * de ajustes). Nada optimista: publica en el store solo cuando el PATCH
 * confirma; si falla (backend viejo, red), el switch no se mueve y la fila lo
 * dice. Vive en Ajustes y en la caja de herramientas.
 */
export default function AdminModeSwitch({
  subtitle = "Todo abierto y herramientas de prueba",
  onChange,
}: {
  subtitle?: string;
  onChange?: (on: boolean) => void;
}) {
  const { estado, encendido } = useAdminMode();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = () => {
    if (busy || estado === "desconocido") return;
    const siguiente = !encendido;
    setBusy(true);
    setError(null);
    setAdminModeService(siguiente)
      .then((r) => {
        fijarModoAdmin(r.admin_mode ? "encendido" : "apagado");
        bumpCuenta();
        onChange?.(r.admin_mode);
      })
      .catch(() => setError("No se pudo cambiar. ¿El backend está al día?"))
      .finally(() => setBusy(false));
  };

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-extrabold text-foreground">Modo admin</span>
        <span className="text-xs font-semibold text-(--muted)">{error ?? subtitle}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={encendido}
        aria-label="Modo admin"
        aria-busy={busy}
        disabled={estado === "desconocido"}
        onClick={toggle}
        className="relative h-7 w-12 shrink-0 rounded-full transition-transform duration-150 active:scale-95 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
        style={{ background: encendido ? "var(--purple)" : "var(--border)" }}
      >
        <span
          aria-hidden
          className="absolute top-1 left-1 h-5 w-5 rounded-full bg-white transition-transform duration-200"
          style={{ transform: encendido ? "translateX(20px)" : "none" }}
        />
      </button>
    </div>
  );
}
