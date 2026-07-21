"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import Doty, { type DotyAnimation } from "@/components/ui/doty/doty";
import Streak from "@/components/interactive-column/streak/streak";
import XpLevel from "@/components/interactive-column/xp-level";
import BadgesCard from "@/components/interactive-column/badges";
import ThemeToggle from "@/components/theme-toggle";
import { getMyStatsService, type MyStats } from "@/services/engagement.service";
import {
  getInventoryService,
  equipItemService,
  type InventoryItem,
} from "@/services/shop.service";
import { ADMIN_PROFILE, resolveAvatarUrl } from "@/constants";
import { useAuth } from "@/context/auth-context";

type StoredUser = {
  name?: string;
  last_name?: string;
  profile?: number;
  profile_pic?: string | null;
};

function readUser(): StoredUser {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}") || {};
  } catch {
    return {};
  }
}

/** Banda CEFR estimada a partir del nivel de XP. */
function cefrBand(level: number): string {
  if (level <= 2) return "A1";
  if (level <= 4) return "A2";
  if (level <= 7) return "B1";
  if (level <= 10) return "B2";
  if (level <= 14) return "C1";
  return "C2";
}

const SLOT_LABEL: Record<string, string> = {
  hat: "Gorros",
  background: "Fondos",
  gesture: "Gestos",
};

export default function ProfilePage() {
  const { logout } = useAuth();
  const [user, setUser] = useState<StoredUser>({});
  const [stats, setStats] = useState<MyStats | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  const loadInventory = useCallback(() => {
    getInventoryService().then((inv) => setInventory(inv.items));
  }, []);

  useEffect(() => {
    setUser(readUser());
    getMyStatsService().then((d) => d && setStats(d));
    loadInventory();
  }, [loadInventory]);

  const avatar = user.profile_pic ? resolveAvatarUrl(user.profile_pic) : null;
  const isAdmin = user.profile === ADMIN_PROFILE;
  const level = stats?.level ?? 1;

  const equipped = (slot: string) =>
    inventory.find((i) => i.slot === slot && i.equippedSlot);
  const hatEmoji = equipped("hat")?.meta?.emoji as string | undefined;
  const bgEmoji = equipped("background")?.meta?.emoji as string | undefined;
  const gestureAnim = equipped("gesture")?.meta?.animation as
    | DotyAnimation
    | undefined;

  const toggleEquip = (item: InventoryItem) => {
    equipItemService(item.id, !item.equippedSlot).then((inv) =>
      setInventory(inv.items),
    );
  };

  const statCards: { label: string; value: string | number }[] = [
    { label: "XP total", value: stats?.xp ?? 0 },
    { label: "Mejor racha", value: `${stats?.bestStreak ?? 0} días` },
    { label: "Lecturas", value: stats?.readingsCompleted ?? 0 },
    { label: "Escudos", value: `❄️ ${stats?.streakFreezes ?? 0}` },
  ];

  const cosmeticSlots = ["hat", "background", "gesture"] as const;
  const hasCosmetics = inventory.some((i) => i.slot);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-extrabold text-foreground">
          Perfil
        </h1>
        <p className="text-sm font-semibold text-(--muted)">
          Tu progreso, tus logros y tu Doty.
        </p>
      </header>

      {/* Tarjeta de perfil + Doty */}
      <div className="dots-card flex flex-col items-center gap-3 p-6 text-center">
        <div className="relative flex h-32 w-32 items-center justify-center">
          {bgEmoji && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 flex items-center justify-center text-7xl opacity-20"
            >
              {bgEmoji}
            </span>
          )}
          {avatar ? (
            <div className="relative h-24 w-24 overflow-hidden rounded-full ring-3 ring-(--accent)/50">
              <Image src={avatar} alt="Foto de perfil" fill style={{ objectFit: "cover" }} />
            </div>
          ) : (
            <Doty pose="06" size="tiny" animation={gestureAnim ?? "bob"} />
          )}
          {hatEmoji && (
            <span
              aria-hidden
              className="absolute -top-1 left-1/2 -translate-x-1/2 text-3xl"
            >
              {hatEmoji}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <h2 className="font-display text-xl font-extrabold text-foreground">
            {user.name || "Aprendiz"} {user.last_name || ""}
          </h2>
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-black"
            style={{
              background: "color-mix(in srgb, var(--primary) 14%, transparent)",
              border: "1.5px solid color-mix(in srgb, var(--primary) 35%, transparent)",
              color: "var(--primary)",
            }}
            title="Nivel de inglés estimado (MCER)"
          >
            {cefrBand(level)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Streak />
        </div>
        <div className="w-full max-w-xs">
          <XpLevel stats={stats} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statCards.map((s) => (
          <div key={s.label} className="dots-card flex flex-col items-center gap-1 p-4">
            <span className="font-display text-xl font-extrabold text-foreground tabular-nums">
              {s.value}
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wide text-(--muted)">
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* Doty custom */}
      <div className="dots-card flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-(--muted)">
            🎨 Tu Doty
          </span>
          <Link href="/shop" className="text-xs font-extrabold text-(--accent)">
            Ir a la tienda →
          </Link>
        </div>
        {!hasCosmetics ? (
          <p className="text-sm font-semibold text-(--muted)">
            Aún no tienes estilos. Compra gorros, fondos y gestos para Doty en la
            tienda con tus gemas.
          </p>
        ) : (
          cosmeticSlots.map((slot) => {
            const owned = inventory.filter((i) => i.slot === slot);
            if (owned.length === 0) return null;
            return (
              <div key={slot} className="flex flex-col gap-2">
                <span className="text-[11px] font-black text-(--muted)">
                  {SLOT_LABEL[slot]}
                </span>
                <div className="flex flex-wrap gap-2">
                  {owned.map((item) => {
                    const on = !!item.equippedSlot;
                    return (
                      <button
                        key={item.id}
                        onClick={() => toggleEquip(item)}
                        className="flex items-center gap-1.5 rounded-2xl px-3 py-2 text-sm font-bold transition-colors"
                        style={{
                          background: on
                            ? "color-mix(in srgb, var(--accent) 14%, transparent)"
                            : "var(--surface-2)",
                          border: on
                            ? "2px solid var(--accent)"
                            : "2px solid var(--border)",
                          color: on ? "var(--accent)" : "var(--foreground)",
                        }}
                      >
                        <span className="text-lg leading-none">
                          {(item.meta?.emoji as string) ?? "🎭"}
                        </span>
                        {item.name}
                        {on && <span>✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Logros */}
      <BadgesCard />

      {/* Ajustes */}
      <div className="dots-card flex flex-col gap-3 p-4">
        <span className="text-[10px] font-bold uppercase tracking-widest text-(--muted)">
          ⚙️ Ajustes
        </span>
        <ThemeToggle />
        {isAdmin && (
          <Link
            href="/admin"
            className="w-full rounded-xl border border-(--border) px-4 py-2 text-center text-sm font-semibold text-(--muted) transition-colors hover:border-(--accent) hover:text-(--accent)"
          >
            Panel de admin ⚙️
          </Link>
        )}
        <button
          onClick={() => void logout()}
          className="w-full rounded-xl border border-(--border) px-4 py-2 text-sm font-semibold text-(--muted) transition-colors hover:border-(--danger) hover:text-(--danger)"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
