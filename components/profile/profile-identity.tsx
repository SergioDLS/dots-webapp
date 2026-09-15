"use client";

import Doty, { type DotyAnimation } from "@/components/ui/doty/doty";
import { Icon } from "@/components/ui/icon";
import { UiIcon } from "@/components/ui/ui-icon";
import { cefrBand } from "@/lib/profile-view";
import type { MyStats } from "@/services/engagement.service";

/**
 * Identidad del perfil (spec §5, variante A "identidad abierta"): Doty, nombre,
 * chips y engranaje, en horizontal y SIN tarjeta — el principio 4 del spec
 * reserva los contenedores para las cabeceras.
 *
 * El avatar es Doty y no lleva lápiz: los avatares llegan con el subproyecto E,
 * y un control que no hace nada es peor que ninguno.
 */
interface Props {
  name: string;
  stats: MyStats | null;
  /** Animación del gesto equipado, si el usuario tiene uno puesto. */
  gestureAnimation?: DotyAnimation;
  onOpenSettings: () => void;
}

export default function ProfileIdentity({ name, stats, gestureAnimation, onOpenSettings }: Props) {
  const band = cefrBand(stats?.level ?? 1);
  const streak = stats?.streak ?? 0;

  return (
    <header className="flex items-center gap-4">
      {/* 78 px en móvil y 96 en escritorio: el par vive en el registro de tamaños. */}
      <div className="shrink-0">
        <Doty pose="feliz" size="perfil" animation={gestureAnimation ?? "bob"} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h1 className="truncate font-display text-2xl font-extrabold text-foreground">{name}</h1>
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className="rounded-full px-2.5 py-0.5 text-[11px] font-black"
            style={{
              background: "color-mix(in srgb, var(--primary) 14%, transparent)",
              border: "1.5px solid color-mix(in srgb, var(--primary) 35%, transparent)",
              color: "var(--primary)",
            }}
            title="Nivel de inglés estimado (MCER)"
          >
            {band.code} · {band.name}
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-black tabular-nums"
            style={{
              background: "color-mix(in srgb, var(--flame) 14%, transparent)",
              border: "1.5px solid color-mix(in srgb, var(--flame) 38%, transparent)",
              color: "var(--flame-edge)",
            }}
            title="Racha diaria"
          >
            <UiIcon name="racha" size={14} />
            {streak}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenSettings}
        aria-label="Abrir ajustes"
        className="shrink-0 rounded-full p-2 text-(--muted) transition-transform duration-150 active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
      >
        <Icon name="ajustes" size={24} mono />
      </button>
    </header>
  );
}
