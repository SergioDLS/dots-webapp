"use client";

import { statRow } from "@/lib/profile-view";
import type { Badge, MyStats } from "@/services/engagement.service";

/**
 * Los cuatro números del perfil (spec §5): fila sin cajas. El emoji ❄️ del
 * contador de escudos que había aquí se fue con ellos: los escudos ya no son
 * uno de los cuatro, y un emoji no es un icono (regla 11).
 */
export default function ProfileStats({ stats, badges }: { stats: MyStats | null; badges: Badge[] }) {
  return (
    <dl className="grid grid-cols-4 gap-2">
      {statRow(stats, badges).map((s) => (
        <div key={s.label} className="flex flex-col-reverse items-center gap-0.5 text-center">
          <dt className="text-[10px] font-bold uppercase tracking-wide text-(--muted)">{s.label}</dt>
          <dd className="font-display text-xl font-extrabold tabular-nums text-foreground">{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}
