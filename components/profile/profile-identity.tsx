"use client";

import AvatarFlip from "@/components/profile/avatar-flip";
import type { DotyAnimation } from "@/components/ui/doty/doty";
import { Icon } from "@/components/ui/icon";
import { UiIcon } from "@/components/ui/ui-icon";
import { cefrBand } from "@/lib/profile-view";
import type { PublicAvatar } from "@/lib/avatar";
import type { MyStats } from "@/services/engagement.service";

/**
 * Identidad del perfil (spec §5, variante A "identidad abierta"): avatar,
 * nombre, chips y engranaje, en horizontal y SIN tarjeta — el principio 4 del
 * spec reserva los contenedores para las cabeceras.
 *
 * El avatar es una carta de dos caras (spec §6.4): retrato al frente y, detrás,
 * Doty con el gesto equipado. Tocar el avatar lo gira; el lápiz es un botón
 * aparte —nunca anidado dentro de él— y el único acceso al selector desde
 * la identidad; la hoja de ajustes conserva el suyo.
 */
interface Props {
  name: string;
  stats: MyStats | null;
  avatar: PublicAvatar | null;
  /** Animación del gesto equipado, o null si no hay ninguno. */
  gesture: DotyAnimation | null;
  /** true cuando /me/settings y el inventario ya respondieron. */
  ready: boolean;
  onChangeAvatar: () => void;
  onOpenSettings: () => void;
}

export default function ProfileIdentity({
  name,
  stats,
  avatar,
  gesture,
  ready,
  onChangeAvatar,
  onOpenSettings,
}: Props) {
  const band = cefrBand(stats?.level ?? 1);
  const streak = stats?.streak ?? 0;
  // La key remonta la carta al cambiar de gesto: reinicia su estado (fijado,
  // hover) y repite el giro de entrada como confirmación de haber equipado.
  const flipKey = gesture ?? "none";

  return (
    <header className="flex items-center gap-4">
      <div className="relative shrink-0">
        {/* 78 px en móvil y 96 en escritorio (no los 128 del §6.1): Ruling 2 del plan de E. */}
        <span className="md:hidden">
          <AvatarFlip key={flipKey} avatar={avatar} gesture={gesture} size={78} ready={ready} />
        </span>
        <span className="hidden md:inline-flex">
          <AvatarFlip key={flipKey} avatar={avatar} gesture={gesture} size={96} ready={ready} />
        </span>
        <button
          type="button"
          onClick={onChangeAvatar}
          aria-label="Cambiar avatar"
          // 40 px de área táctil (WCAG 2.5.8 recomienda 44; el mínimo es 24) alrededor
          // de un lápiz visible de 28: el centro queda en el mismo punto que antes.
          className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-full transition-transform duration-150 active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
        >
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full"
            style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
          >
            <Icon name="lapiz" size={14} mono />
          </span>
        </button>
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
            role="img"
            aria-label={`Racha: ${streak} días`}
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
