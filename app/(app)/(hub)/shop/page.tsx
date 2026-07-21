"use client";

import { useEffect, useState } from "react";

import Doty from "@/components/ui/doty/doty";
import {
  getShopService,
  buyItemService,
  type ShopItem,
} from "@/services/shop.service";

const kindIcon = (item: ShopItem): string => {
  const emoji = item.meta?.emoji;
  if (typeof emoji === "string") return emoji;
  if (item.kind === "streak_shield") return "❄️";
  if (item.kind === "xp_boost") return "⚡";
  if (item.kind === "gesture") return "🎭";
  return "🎁";
};

const KIND_LABEL: Record<string, string> = {
  streak_shield: "Escudos y boosts",
  xp_boost: "Escudos y boosts",
  cosmetic: "Para tu Doty",
  gesture: "Gestos de Doty",
};

export default function ShopPage() {
  const [balance, setBalance] = useState(0);
  const [items, setItems] = useState<ShopItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = () => {
    getShopService().then((s) => {
      setBalance(s.balance);
      setItems(s.items);
    });
  };
  useEffect(load, []);

  const buy = (item: ShopItem) => {
    if (busy) return;
    setBusy(item.key);
    setMsg(null);
    buyItemService(item.key)
      .then((res) => {
        setBalance(res.balance);
        setMsg(`¡Compraste ${item.name}!`);
        load();
      })
      .catch((e: unknown) => {
        const ax = e as { response?: { data?: { message?: string } } };
        setMsg(ax?.response?.data?.message ?? "No se pudo comprar");
      })
      .finally(() => setBusy(null));
  };

  if (items === null) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-(--border) border-t-(--accent)" />
      </div>
    );
  }

  const consumable = (k: string) => k === "streak_shield" || k === "xp_boost";
  const groups = Array.from(new Set(items.map((i) => KIND_LABEL[i.kind] ?? "Otros")));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-extrabold text-foreground">
            Tienda
          </h1>
          <p className="text-sm font-semibold text-(--muted)">
            Gasta tus gemas en escudos, boosts y estilos para Doty.
          </p>
        </div>
        <span
          className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 font-black tabular-nums"
          style={{
            background: "color-mix(in srgb, var(--gem) 15%, transparent)",
            border: "1.5px solid color-mix(in srgb, var(--gem) 40%, transparent)",
            color: "var(--gem-edge)",
          }}
        >
          💎 {balance}
        </span>
      </header>

      {msg && (
        <p
          className="rounded-2xl px-4 py-2.5 text-center text-sm font-bold"
          style={{
            background: "var(--surface-2)",
            border: "1.5px solid var(--border)",
            color: "var(--foreground)",
            animation: "dots-pop-in 0.3s ease-out both",
          }}
        >
          {msg}
        </p>
      )}

      {items.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Doty pose="05" size="small" />
          <p className="text-sm font-semibold text-(--muted)">
            La tienda abre muy pronto.
          </p>
        </div>
      )}

      {groups.map((group) => (
        <section key={group} className="flex flex-col gap-3">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-(--muted)">
            {group}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {items
              .filter((i) => (KIND_LABEL[i.kind] ?? "Otros") === group)
              .map((item) => {
                const affordable = balance >= item.price;
                const owned = item.owned && !consumable(item.kind);
                return (
                  <div
                    key={item.id}
                    className="dots-card flex flex-col items-center gap-2 p-4 text-center"
                  >
                    <span className="text-4xl leading-none">{kindIcon(item)}</span>
                    <span className="text-sm font-extrabold leading-tight text-foreground">
                      {item.name}
                    </span>
                    {item.description && (
                      <span className="text-[11px] font-semibold leading-tight text-(--muted)">
                        {item.description}
                      </span>
                    )}
                    <button
                      disabled={owned || busy === item.key || (!affordable && !owned)}
                      onClick={() => buy(item)}
                      className="dots-pressable mt-1 w-full rounded-xl px-3 py-2 text-xs font-black disabled:opacity-55"
                      style={{
                        background: owned ? "var(--surface-2)" : "var(--accent)",
                        color: owned ? "var(--muted)" : "var(--accent-contrast)",
                        ["--press-color" as string]: "var(--accent-edge)",
                      }}
                    >
                      {owned
                        ? "✓ Tienes"
                        : busy === item.key
                          ? "…"
                          : `💎 ${item.price}`}
                    </button>
                  </div>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}
