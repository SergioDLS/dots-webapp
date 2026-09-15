"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { PALETTE_ACCENTS, PALETTES, PALETTE_LABELS, type Palette } from "@/lib/theme-colors";
import { readSoundEnabled, writeSoundEnabled } from "@/lib/sound-prefs";
import {
  applyThemePrefs,
  normalizePrefs,
  readMirror,
  writeMirror,
  type ThemeMode,
} from "@/lib/theme-prefs";
import { patchMySettingsService } from "@/services/settings.service";

/**
 * Hoja de ajustes del perfil (spec §5): inferior en móvil, lateral en
 * escritorio. Cada control escribe el espejo local, aplica el cambio al DOM y
 * manda un PATCH /me/settings en segundo plano.
 *
 * NO lleva fila "Cambiar avatar": los avatares son el subproyecto E, que según
 * el spec §8 depende de este. Un control que no hace nada es peor que ninguno.
 *
 * El estado visible sale del DOM y de localStorage con `useSyncExternalStore`,
 * el mismo patrón que usaba el toggle que esta hoja reemplaza: el servidor no
 * sabe si el sistema operativo está en oscuro, así que leerlo en el render
 * rompería la hidratación (regla 12).
 */

const MODE_LABELS: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
  { value: "auto", label: "Auto" },
];

/**
 * El DOM es la fuente de verdad de paleta, modo y sonido: la fija el script
 * anti-parpadeo antes del primer paint y la cambian los controles de esta hoja.
 * `data-sound` está en el filtro a propósito: el espejo de sonido no dispara
 * ningún evento en la misma pestaña, así que el atributo es lo que avisa.
 */
function subscribeDom(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-palette", "data-theme", "data-sound"],
  });
  return () => observer.disconnect();
}
const domSnapshot = (): string => {
  const root = document.documentElement;
  const resolved = root.classList.contains("dark") ? "dark" : "light";
  return `${root.dataset.palette ?? "rosa"}|${root.dataset.theme ?? "auto"}|${resolved}|${readSoundEnabled() ? "on" : "off"}`;
};
const domServerSnapshot = (): string => "rosa|auto|light|on";

function Row({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-extrabold text-foreground">{title}</span>
        {subtitle && <span className="text-xs font-semibold text-(--muted)">{subtitle}</span>}
      </span>
      {children}
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
  onLogout: () => void;
}

export default function SettingsSheet({ open, onClose, isAdmin, onLogout }: Props) {
  const dom = useSyncExternalStore(subscribeDom, domSnapshot, domServerSnapshot);
  const [palette, mode, resolved, soundFlag] = dom.split("|") as [
    Palette,
    ThemeMode,
    "light" | "dark",
    string,
  ];
  const sound = soundFlag !== "off";

  // Cerrar con Escape y bloquear el scroll del fondo mientras la hoja está abierta.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  /** Escribe espejo + DOM + servidor. El PATCH falla en silencio: el espejo conserva la elección. */
  const setTheme = (next: { palette?: Palette; mode?: ThemeMode }) => {
    const prefs = normalizePrefs({ ...readMirror(), ...next });
    writeMirror(prefs);
    applyThemePrefs(prefs);
    void patchMySettingsService(next).catch(() => {});
  };

  const setSound = (on: boolean) => {
    writeSoundEnabled(on);
    // Toca un atributo del <html> para que el useSyncExternalStore de arriba
    // se entere: el espejo de sonido no tiene evento propio en la misma pestaña.
    document.documentElement.dataset.sound = on ? "on" : "off";
    void patchMySettingsService({ sound: on }).catch(() => {});
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-stretch md:justify-end">
      <div
        aria-hidden
        onClick={onClose}
        className="absolute inset-0"
        style={{ background: "var(--scrim)" }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ajustes"
        className="relative z-10 flex max-h-[85vh] w-full flex-col overflow-y-auto rounded-t-3xl bg-(--surface) px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 [animation:dots-slide-up_.25s_ease-out_both] md:max-h-none md:w-[380px] md:rounded-none md:rounded-l-3xl md:pb-5 md:[animation:dots-slide-right_.25s_ease-out_both]"
      >
        <div className="flex items-center justify-between gap-2 pb-2">
          <h2 className="font-display text-xl font-extrabold text-foreground">Ajustes</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ajustes"
            className="rounded-full p-2 text-(--muted) transition-transform duration-150 active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
          >
            <Icon name="cruz" size={20} mono />
          </button>
        </div>

        {/* Tema */}
        <section className="flex flex-col gap-2 border-t border-(--border) pt-3">
          <span className="text-xs font-bold uppercase tracking-widest text-(--muted)">Tema</span>
          <div className="grid grid-cols-2 gap-2">
            {PALETTES.map((p) => {
              const on = p === palette;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setTheme({ palette: p })}
                  aria-pressed={on}
                  className="flex items-center gap-2 rounded-2xl px-3 py-2.5 transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
                  style={{
                    background: on ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "var(--surface-2)",
                    border: on ? "2px solid var(--accent)" : "2px solid transparent",
                  }}
                >
                  <span
                    aria-hidden
                    className="h-5 w-5 shrink-0 rounded-full"
                    style={{ background: PALETTE_ACCENTS[p][resolved] }}
                  />
                  <span className="text-sm font-extrabold text-foreground">{PALETTE_LABELS[p]}</span>
                </button>
              );
            })}
          </div>
          <p className="text-xs font-semibold text-(--muted)">Doty siempre es rosa, el resto cambia</p>
        </section>

        {/* Modo */}
        <section className="flex flex-col gap-2 border-t border-(--border) pt-3">
          <span className="text-xs font-bold uppercase tracking-widest text-(--muted)">Modo</span>
          <div className="grid grid-cols-3 gap-2">
            {MODE_LABELS.map((m) => {
              const on = m.value === mode;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setTheme({ mode: m.value })}
                  aria-pressed={on}
                  className="rounded-2xl px-2 py-2 text-sm font-extrabold transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
                  style={{
                    background: on ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "var(--surface-2)",
                    border: on ? "2px solid var(--accent)" : "2px solid transparent",
                    color: on ? "var(--accent)" : "var(--foreground)",
                  }}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Sonidos */}
        <section className="border-t border-(--border)">
          <Row title="Sonidos" subtitle="Aciertos, fallos y celebraciones">
            <button
              type="button"
              role="switch"
              aria-checked={sound}
              aria-label="Sonidos"
              onClick={() => setSound(!sound)}
              className="relative h-7 w-12 shrink-0 rounded-full transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
              style={{ background: sound ? "var(--accent)" : "var(--border)" }}
            >
              <span
                aria-hidden
                className="absolute top-1 left-1 h-5 w-5 rounded-full bg-white transition-transform duration-200"
                style={{ transform: sound ? "translateX(20px)" : "none" }}
              />
            </button>
          </Row>
        </section>

        {/* Acciones */}
        <section className="flex flex-col gap-2 border-t border-(--border) pt-3">
          {isAdmin && (
            <Link
              href="/admin"
              onClick={onClose}
              className="flex items-center justify-between rounded-2xl bg-(--surface-2) px-4 py-3 text-sm font-extrabold text-foreground"
            >
              Panel de admin
              <Icon name="derecha" size={16} mono />
            </Link>
          )}
          <button
            type="button"
            onClick={onLogout}
            className="rounded-2xl px-4 py-3 text-sm font-extrabold transition-transform duration-150 active:scale-95"
            style={{ background: "color-mix(in srgb, var(--danger) 12%, transparent)", color: "var(--danger)" }}
          >
            Cerrar sesión
          </button>
        </section>
      </div>
    </div>
  );
}
