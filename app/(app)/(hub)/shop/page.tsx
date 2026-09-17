"use client";

import { useEffect, useState, type ReactNode } from "react";

import Avatar from "@/components/ui/avatar/avatar";
import Doty from "@/components/ui/doty/doty";
import { Icon } from "@/components/ui/icon";
import { UiIcon } from "@/components/ui/ui-icon";
import type { PublicAvatar } from "@/lib/avatar";
import {
  getShopService,
  buyItemService,
  type ShopItem,
} from "@/services/shop.service";
import { getMySettingsService, postMyAvatarService } from "@/services/settings.service";

const kindIcon = (item: ShopItem): ReactNode => {
  if (item.kind === "streak_shield") return <Icon name="escudo" size={36} />;
  if (item.kind === "xp_boost") return <UiIcon name="rayo" size={36} />;
  return <UiIcon name="regalo" size={36} />;
};

const KIND_LABEL: Record<string, string> = {
  streak_shield: "Escudos y boosts",
  xp_boost: "Escudos y boosts",
  gesture: "Gestos de Doty",
};

/** ShopItem -> PublicAvatar para pintar el retrato con <Avatar>. */
const toAvatar = (item: ShopItem): PublicAvatar => ({
  img: item.img ?? "",
  color: (item.meta?.color as string) ?? "#FF1F8F",
});

export default function ShopPage() {
  const [balance, setBalance] = useState(0);
  const [items, setItems] = useState<ShopItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [avatarKey, setAvatarKey] = useState<string | null>(null);

  const load = () => {
    getShopService().then((s) => {
      setBalance(s.balance);
      setItems(s.items);
    });
  };
  useEffect(load, []);

  useEffect(() => {
    getMySettingsService().then((s) => {
      // Sin key equipada el backend igual resuelve "clasico" en perfil, ranking
      // y aviso de rival: mismo fallback aquí para que la tienda coincida.
      if (s) setAvatarKey(s.avatar_key ?? "clasico");
    });
  }, []);

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

  // No hace falta releer /shop ni /me/settings: lo único que cambia al usar
  // un avatar es cuál está equipado, y ya conocemos la key que pedimos. El
  // POST devuelve { img, color } (spec §6.1), no la key, así que "refrescar
  // con lo que devuelva" es esperar a que resuelva con éxito, no leerla del
  // cuerpo de la respuesta.
  const equipAvatar = (item: ShopItem) => {
    if (busy) return;
    setBusy(item.key);
    setMsg(null);
    postMyAvatarService(item.key)
      .then(() => {
        setAvatarKey(item.key);
        setMsg("¡Avatar actualizado!");
      })
      .catch((e: unknown) => {
        const ax = e as { response?: { data?: { message?: string } } };
        setMsg(ax?.response?.data?.message ?? "No se pudo usar ese avatar");
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
  const shoppable = items;
  // Los avatares se pintan en su propia sección (retrato, no icono): fuera de
  // groupable para que no salgan también como una tarjeta más de "Otros".
  const avatarItems = shoppable.filter((i) => i.kind === "avatar");
  // Una tienda no debe ofrecer algo que la app no sabe renderizar: sin etiqueta
  // no hay pantalla para equiparlo — se añade junto con esa pantalla al reactivar.
  const groupable = shoppable.filter((i) => i.kind !== "avatar" && KIND_LABEL[i.kind]);
  const groups = Array.from(new Set(groupable.map((i) => KIND_LABEL[i.kind] ?? "Otros")));

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
          <UiIcon name="gemas" size={16} /> {balance}
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
          <Doty pose="timido" size="small" />
          <p className="text-sm font-semibold text-(--muted)">
            La tienda abre muy pronto.
          </p>
        </div>
      )}

      {avatarItems.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-(--muted)">
            Avatares
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {avatarItems.map((item) => {
              const label = (item.meta?.label as string) ?? item.name;
              const affordable = balance >= item.price;
              const equipped = item.key === avatarKey;
              const usable = item.owned || item.price === 0;
              return (
                <div
                  key={item.id}
                  className="dots-card flex flex-col items-center gap-2 p-4 text-center"
                >
                  <Avatar avatar={toAvatar(item)} size={96} alt="" />
                  <span className="text-sm font-extrabold leading-tight text-foreground">
                    {label}
                  </span>
                  {equipped ? (
                    <span
                      className="mt-1 inline-flex items-center gap-1 text-xs font-black"
                      style={{ color: "var(--accent)" }}
                    >
                      <Icon name="check" size={16} /> Lo tienes
                    </span>
                  ) : usable ? (
                    <button
                      disabled={busy === item.key}
                      onClick={() => equipAvatar(item)}
                      className="dots-pressable mt-1 w-full rounded-xl px-3 py-2 text-xs font-black disabled:opacity-55"
                      style={{
                        background: "var(--accent)",
                        color: "var(--accent-contrast)",
                        ["--press-color" as string]: "var(--accent-edge)",
                      }}
                    >
                      {busy === item.key ? "…" : "Usar"}
                    </button>
                  ) : (
                    <button
                      disabled={busy === item.key || !affordable}
                      onClick={() => buy(item)}
                      className="dots-pressable mt-1 w-full rounded-xl px-3 py-2 text-xs font-black disabled:opacity-55"
                      style={{
                        background: "var(--accent)",
                        color: "var(--accent-contrast)",
                        ["--press-color" as string]: "var(--accent-edge)",
                      }}
                    >
                      {busy === item.key
                        ? "…"
                        : <span className="inline-flex items-center gap-1"><UiIcon name="gemas" size={16} /> {item.price}</span>}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {groups.map((group) => (
        <section key={group} className="flex flex-col gap-3">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-(--muted)">
            {group}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {groupable
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
                        ? <span className="inline-flex items-center gap-1"><Icon name="check" size={16} /> Tienes</span>
                        : busy === item.key
                          ? "…"
                          : <span className="inline-flex items-center gap-1"><UiIcon name="gemas" size={16} /> {item.price}</span>}
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
