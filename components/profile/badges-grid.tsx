"use client";

import type { Badge } from "@/services/engagement.service";

/**
 * Insignias del perfil (spec §5): tile dorado suave de 58 px, bloqueadas en
 * gris con "n / m". Siempre abiertas — el desplegable anterior escondía el
 * único sitio donde se ven los logros.
 *
 * El emoji de cada insignia viene del backend (Badge.emoji) y no está cableado
 * aquí; sustituirlo por iconografía propia exige arte que el spec §9 deja
 * fuera de alcance.
 */
export const BADGE_TILE = 58;

export default function BadgesGrid({ badges }: { badges: Badge[] }) {
  if (badges.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-bold uppercase tracking-widest text-(--muted)">Insignias</h2>
      <ul className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
        {badges.map((b) => (
          <li key={b.key}>
            <div
              title={b.earned ? b.title : `${b.title} — ${b.progress}/${b.goal}`}
              className="flex flex-col items-center justify-center gap-0.5 rounded-2xl px-1"
              style={{
                height: BADGE_TILE,
                background: b.earned
                  ? "color-mix(in srgb, var(--gold) 14%, transparent)"
                  : "var(--surface-2)",
              }}
            >
              <span
                className="text-xl leading-none"
                // filter estático, no animado: RN-safe (regla 2).
                style={b.earned ? undefined : { filter: "grayscale(1)", opacity: 0.4 }}
              >
                {b.emoji}
              </span>
              {!b.earned && (
                <span className="text-[9px] font-bold tabular-nums text-(--muted)">
                  {b.progress}/{b.goal}
                </span>
              )}
            </div>
            <p
              className="line-clamp-2 pt-1 text-center text-[10px] font-extrabold leading-tight"
              style={{ color: b.earned ? "var(--foreground)" : "var(--muted)" }}
            >
              {b.title}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
