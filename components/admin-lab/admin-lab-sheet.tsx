"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useToast } from "@/components/admin/ui";
import Doty from "@/components/ui/doty/doty";
import { Icon } from "@/components/ui/icon";
import OverlayPortal from "@/components/ui/overlay-portal";
import { bumpCuenta } from "@/lib/account-refresh";
import { clearAvatarMirror } from "@/lib/avatar-mirror";
import { borrarEspejo, fijarPrimerInicio } from "@/lib/first-run";
import { borrarMarca } from "@/lib/install-browser";
import { bloquearScroll } from "@/lib/scroll-lock";
import {
  completeCurrentSectionService,
  grantMyselfService,
  resetMyFirstRunService,
  resetMyProgressService,
  type GrantPayload,
} from "@/services/admin-lab.service";
import AdminModeSwitch from "./admin-mode-switch";

/**
 * Caja de herramientas del modo admin (spec 2026-09-29). Misma hoja que
 * Ajustes: inferior en móvil, lateral en escritorio. Todo es tap: sin
 * teclado, sin <input>, sin <select> (regla 2). Cada botón lleva su propio
 * "ocupado"; el resultado se dice en una línea dentro de la hoja (un toast
 * `fixed` dentro del panel animado con transform se posicionaría respecto al
 * panel, no al viewport). Tras cada acción exitosa se bumpea la cuenta para
 * que HUD, Camino y arcade vuelvan a pedir.
 */

interface Props {
  open: boolean;
  onClose: () => void;
}

type Accion = "primer-inicio" | "seccion" | "reset" | "gemas100" | "gemas1000" | "xp500" | "racha7" | "racha30";

const PALANCAS: Array<{ key: Accion; label: string; payload: GrantPayload }> = [
  { key: "gemas100", label: "+100 gemas", payload: { gems: 100 } },
  { key: "gemas1000", label: "+1000 gemas", payload: { gems: 1000 } },
  { key: "xp500", label: "+500 XP", payload: { xp: 500 } },
  { key: "racha7", label: "Racha de 7", payload: { streak: 7 } },
  { key: "racha30", label: "Racha de 30", payload: { streak: 30 } },
];

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-(--border) pt-3">
      <span className="text-xs font-bold uppercase tracking-widest text-(--muted)">{titulo}</span>
      {children}
    </section>
  );
}

function Boton({
  children,
  subtitle,
  busy,
  disabledAll,
  danger = false,
  onClick,
}: {
  children: React.ReactNode;
  subtitle?: string;
  busy?: boolean;
  disabledAll?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabledAll}
      aria-busy={busy}
      className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-sm font-extrabold transition-transform duration-150 active:scale-95 disabled:opacity-60"
      style={
        danger
          ? { background: "color-mix(in srgb, var(--danger) 12%, transparent)", color: "var(--danger)" }
          : { background: "var(--surface-2)", color: "var(--foreground)" }
      }
    >
      <span className="flex min-w-0 flex-col">
        <span>{children}</span>
        {subtitle && <span className="text-xs font-semibold text-(--muted)">{subtitle}</span>}
      </span>
      <Icon name="derecha" size={16} mono />
    </button>
  );
}

export default function AdminLabSheet({ open, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [ocupado, setOcupado] = useState<Accion | null>(null);
  const [aviso, decir] = useToast();
  const router = useRouter();
  // Dos pasos: el primer tap solo abre la confirmación; nada se borra sin el segundo.
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setConfirmando(false);
      onClose();
    };
    document.addEventListener("keydown", onKey);
    const soltar = bloquearScroll();
    return () => {
      document.removeEventListener("keydown", onKey);
      soltar();
    };
  }, [open, onClose]);

  if (!open) return null;

  // `if (!open) return null` no desmonta el estado: sin esto, la confirmación
  // quedaría abierta al volver a abrir la hoja. Se resetea desde los
  // manejadores de cierre, nunca desde un efecto (regla 3).
  const cerrar = () => {
    setConfirmando(false);
    onClose();
  };

  const correr = (key: Accion, tarea: () => Promise<string>) => {
    if (ocupado) return;
    setOcupado(key);
    tarea()
      .then((texto) => {
        bumpCuenta();
        decir(texto);
      })
      .catch(() => decir("No salió. Revisa el backend.", "error"))
      .finally(() => setOcupado(null));
  };

  const palanca = (key: Accion, payload: GrantPayload, label: string) =>
    correr(key, () => grantMyselfService(payload).then(() => `Listo: ${label}.`));

  const primerInicio = () =>
    correr("primer-inicio", () =>
      resetMyFirstRunService().then(() => {
        borrarEspejo();
        return "La bienvenida vuelve a salir al entrar.";
      }),
    );

  const seccion = () =>
    correr("seccion", () =>
      completeCurrentSectionService().then((s) => `«${s.name}» completada.`),
    );

  const reiniciar = () =>
    correr("reset", () =>
      resetMyProgressService().then(({ deleted }) => {
        // Este dispositivo también olvida: sin esto la bienvenida no saldría
        // (espejo dots-onboarded) y la cara sería la anterior un instante.
        borrarEspejo();
        clearAvatarMirror();
        fijarPrimerInicio("pendiente");
        const filas = Object.values(deleted).reduce((a, b) => a + b, 0);
        // Directo a /welcome y no a /levels: FirstRunGate ya corrió en esta
        // carga y no volvería a preguntar. La bienvenida estampa onboarded y
        // sigue al placement, el mismo recorrido de un alumno recién invitado.
        router.push("/welcome");
        cerrar();
        return `Cuenta como recién invitada (${filas} filas menos).`;
      }),
    );

  const olvidarDispositivo = () => {
    borrarMarca();
    borrarEspejo();
    decir("Este dispositivo ya no recuerda los avisos.");
  };

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-50 flex items-end justify-center md:items-stretch md:justify-end">
        <div aria-hidden onClick={cerrar} className="absolute inset-0" style={{ background: "var(--scrim)" }} />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Modo admin"
          tabIndex={-1}
          className="relative z-10 flex max-h-[85svh] w-full flex-col overflow-y-auto rounded-t-3xl bg-(--surface) px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 [animation:dots-slide-up_.25s_ease-out_both] md:max-h-none md:w-[380px] md:rounded-none md:rounded-l-3xl md:pb-5 md:[animation:dots-slide-right_.25s_ease-out_both]"
        >
          <div className="flex items-center justify-between gap-2 pb-2">
            <h2 className="font-display text-xl font-extrabold text-foreground">Modo admin</h2>
            <button
              type="button"
              onClick={cerrar}
              aria-label="Cerrar"
              className="rounded-full p-2 text-(--muted) transition-transform duration-150 active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
            >
              <Icon name="cruz" size={20} mono />
            </button>
          </div>

          {/* Resultado de la última acción, dentro de la hoja. */}
          <p
            role="status"
            aria-live="polite"
            className="min-h-5 truncate text-xs font-bold"
            style={{ color: aviso ? (aviso.kind === "ok" ? "var(--success)" : "var(--danger)") : "transparent" }}
          >
            {aviso?.text ?? "\u00a0"}
          </p>

          <section className="border-t border-(--border)">
            <AdminModeSwitch
              subtitle="Todo abierto. Nadie más ve esto."
              onChange={(on) => {
                if (!on) onClose();
              }}
            />
          </section>

          <Grupo titulo="Progreso">
            {confirmando ? (
              <div
                className="flex flex-col items-center gap-3 rounded-2xl px-4 py-4 text-center"
                style={{ background: "color-mix(in srgb, var(--danger) 8%, var(--surface-2))" }}
              >
                <Doty pose="oh-no" size="tiny" animation="sad" />
                <p className="font-display text-base font-extrabold text-foreground">
                  ¿Borrar todo tu progreso?
                </p>
                <p className="text-xs font-semibold text-(--muted)">
                  Se va: camino, repaso, placement, checkpoints, récords y ghosts, torneo,
                  gemas e inventario, bienvenida y pistas.
                </p>
                <p className="text-xs font-semibold text-(--muted)">
                  Se queda: retos 1v1, tema y el modo admin.
                </p>
                <div className="grid w-full grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmando(false)}
                    disabled={ocupado === "reset"}
                    className="rounded-2xl bg-(--surface) px-3 py-2.5 text-sm font-extrabold text-foreground transition-transform duration-150 active:scale-95"
                  >
                    Mejor no
                  </button>
                  <button
                    type="button"
                    onClick={reiniciar}
                    disabled={ocupado !== null}
                    aria-busy={ocupado === "reset"}
                    className="rounded-2xl px-3 py-2.5 text-sm font-extrabold text-white transition-transform duration-150 active:scale-95 disabled:opacity-60"
                    style={{ background: "var(--danger)", boxShadow: "0 3px 0 var(--danger-edge)" }}
                  >
                    Sí, borrar mi progreso
                  </button>
                </div>
              </div>
            ) : (
              <Boton
                danger
                subtitle="Cuenta como recién invitada"
                disabledAll={ocupado !== null}
                onClick={() => setConfirmando(true)}
              >
                Reiniciar todo
              </Boton>
            )}
            <Boton
              busy={ocupado === "primer-inicio"}
              disabledAll={ocupado !== null}
              onClick={primerInicio}
            >
              Repetir el primer inicio
            </Boton>
            <Boton
              busy={ocupado === "seccion"}
              disabledAll={ocupado !== null}
              subtitle="Escribe progreso de verdad, como el placement"
              onClick={seccion}
            >
              Completar la sección actual
            </Boton>
          </Grupo>

          <Grupo titulo="HUD">
            <div className="grid grid-cols-2 gap-2">
              {PALANCAS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  disabled={ocupado !== null}
                  aria-busy={ocupado === p.key}
                  onClick={() => palanca(p.key, p.payload, p.label)}
                  className="rounded-2xl bg-(--surface-2) px-3 py-2.5 text-sm font-extrabold text-foreground transition-transform duration-150 active:scale-95 disabled:opacity-60"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Grupo>

          <Grupo titulo="Este dispositivo">
            <Boton
              subtitle="La invitación a instalar y la bienvenida local"
              disabledAll={ocupado !== null}
              onClick={olvidarDispositivo}
            >
              Olvidar avisos de instalación
            </Boton>
          </Grupo>

          <section className="flex flex-col gap-2 border-t border-(--border) pt-3">
            <Link
              href="/admin"
              onClick={cerrar}
              className="flex items-center justify-between rounded-2xl bg-(--surface-2) px-4 py-3 text-sm font-extrabold text-foreground"
            >
              Panel de admin
              <Icon name="derecha" size={16} mono />
            </Link>
          </section>
        </div>
      </div>
    </OverlayPortal>
  );
}
