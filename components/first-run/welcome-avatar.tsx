"use client";

import Avatar from "@/components/ui/avatar/avatar";
import Doty from "@/components/ui/doty/doty";
import { Icon } from "@/components/ui/icon";
import type { PublicAvatar } from "@/lib/avatar";
import type { ShopItem } from "@/services/shop.service";

/**
 * Pantalla 3 del primer inicio (spec §7.2): los seis avatares gratis a 86 px.
 *
 * La lista puede llegar VACÍA mientras el sembrado de `shop_items` no se haya
 * aplicado en producción. Ese caso no bloquea: se explica y el botón cierra el
 * primer inicio igual, porque el backend resuelve `clasico` por su cuenta y el
 * perfil permite cambiarlo después.
 */
interface Props {
  items: ShopItem[];
  pickedKey: string | null;
  onPick: (key: string) => void;
  onFinish: () => void;
  busy: boolean;
}

/** `meta` es jsonb libre: lo que no venga con la forma esperada cae a algo usable. */
function etiqueta(item: ShopItem): string {
  const label = item.meta?.label;
  return typeof label === "string" && label.length > 0 ? label : item.name;
}

function comoAvatar(item: ShopItem): PublicAvatar {
  const color = item.meta?.color;
  return {
    img: item.img ?? "",
    color: typeof color === "string" && color.length > 0 ? color : "#FF1F8F",
  };
}

export default function WelcomeAvatar({ items, pickedKey, onPick, onFinish, busy }: Props) {
  const elegido = items.find((i) => i.key === pickedKey) ?? null;

  return (
    <div className="flex w-full flex-col items-center gap-5 text-center">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-2xl font-extrabold text-foreground">Elige tu Doty</h1>
        <p className="text-sm font-semibold text-(--muted)">Es tu cara en el ranking y en el Camino.</p>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3">
          <Doty pose="pensando" size="small" />
          <p className="max-w-xs text-sm font-semibold text-(--muted)">
            Los avatares llegan en un momento. Puedes elegir el tuyo desde tu perfil cuando quieras.
          </p>
        </div>
      ) : (
        <ul className="grid w-full grid-cols-3 gap-3">
          {items.map((item) => {
            const on = item.key === pickedKey;
            return (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => onPick(item.key)}
                  aria-pressed={on}
                  className="flex w-full flex-col items-center gap-1.5 rounded-2xl px-1 py-2.5 transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
                  style={{
                    background: on ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "transparent",
                    border: on ? "2px solid var(--accent)" : "2px solid transparent",
                  }}
                >
                  {/* 86 px (spec §7.2): sin marco, la sombra teñida la pone <Avatar>. */}
                  <Avatar avatar={comoAvatar(item)} size={86} />
                  <span
                    className="line-clamp-1 text-[11px] font-extrabold"
                    style={{ color: on ? "var(--accent)" : "var(--foreground)" }}
                  >
                    {etiqueta(item)}
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

      <button
        type="button"
        onClick={onFinish}
        disabled={busy}
        className="dots-pressable w-full max-w-xs rounded-2xl px-6 py-3.5 text-base font-black transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent) disabled:opacity-60"
        style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
      >
        {elegido ? `Listo, soy ${etiqueta(elegido)}` : "Listo"}
      </button>
    </div>
  );
}
