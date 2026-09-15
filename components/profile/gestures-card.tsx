"use client";

import Link from "next/link";

import Doty, { type DotyAnimation } from "@/components/ui/doty/doty";
import { Icon } from "@/components/ui/icon";
import { gestureItems } from "@/lib/profile-view";
import type { InventoryItem } from "@/services/shop.service";

/**
 * "Gesto de tu Doty" (spec §5): tarjetas con el equipado marcado y enlace a la
 * tienda. Gorros y fondos dejan de pintarse en D: eran emoji sobre Doty y se
 * retiran con reembolso en el subproyecto E (spec §6.2).
 */
interface Props {
  items: InventoryItem[];
  onToggle: (item: InventoryItem) => void;
}

export default function GesturesCard({ items, onToggle }: Props) {
  const gestures = gestureItems(items);

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
          Todavía no tienes gestos. Cámbiale el movimiento a Doty con tus gemas.
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {gestures.map((item) => {
            const on = item.equippedSlot === "gesture";
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
                    pose="feliz"
                    size="micro"
                    animation={(item.meta?.animation as DotyAnimation | undefined) ?? "none"}
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
      )}
    </section>
  );
}
