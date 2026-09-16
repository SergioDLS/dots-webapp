"use client";

import Link from "next/link";

import Doty from "@/components/ui/doty/doty";
import { Icon } from "@/components/ui/icon";
import { gestureAnimation, gesturePose } from "@/lib/avatar-flip";
import { gestureItems } from "@/lib/profile-view";
import type { InventoryItem } from "@/services/shop.service";

/**
 * "Gesto de tu Doty" (spec §5): tarjetas con el equipado marcado y enlace a la
 * tienda. El gesto se ve en el dorso del avatar (spec §6.4): la tarjeta lo dice
 * y pinta cada miniatura con la misma pose que usa el dorso, para que las dos
 * cuenten lo mismo. Gorros y fondos se retiraron en el subproyecto E (§6.2).
 */
interface Props {
  items: InventoryItem[];
  onToggle: (item: InventoryItem) => void;
}

export default function GesturesCard({ items, onToggle }: Props) {
  const gestures = gestureItems(items);
  const equipped = gestures.some((g) => g.equippedSlot === "gesture");

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-widest text-(--muted)">Gesto de tu Doty</h2>
        <Link href="/shop" className="text-xs font-extrabold text-(--accent)">
          Ir a la tienda
        </Link>
      </div>

      {gestures.length === 0 ? (
        <p className="text-sm font-semibold text-(--muted)">
          Todavía no tienes gestos. Consíguelos en la tienda: tu Doty los hace detrás de tu avatar.
        </p>
      ) : (
        <>
          <p className="text-xs font-semibold text-(--muted)">
            {equipped
              ? "Tu Doty lo hace detrás de tu avatar al abrir el perfil. Toca el avatar para verlo otra vez."
              : "Elige uno y tu Doty lo hará detrás de tu avatar."}
          </p>
          <ul className="grid grid-cols-3 gap-2">
            {gestures.map((item) => {
              const on = item.equippedSlot === "gesture";
              const animation = gestureAnimation(item);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onToggle(item)}
                    aria-pressed={on}
                    className="flex w-full flex-col items-center gap-1 rounded-2xl px-2 py-3 transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
                    style={{
                      background: on ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "var(--surface-2)",
                      border: on ? "2px solid var(--accent)" : "2px solid transparent",
                    }}
                  >
                    <Doty
                      pose={animation ? gesturePose(animation) : "feliz"}
                      size="micro"
                      animation={animation ?? "none"}
                    />
                    <span
                      className="line-clamp-1 text-[11px] font-extrabold"
                      style={{ color: on ? "var(--accent)" : "var(--foreground)" }}
                    >
                      {item.name}
                    </span>
                    <span className="h-4" style={{ color: "var(--accent)" }}>
                      {on && <Icon name="check" size={14} mono />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
