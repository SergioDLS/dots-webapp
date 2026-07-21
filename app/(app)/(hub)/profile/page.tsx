"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import Doty from "@/components/ui/doty/doty";
import Streak from "@/components/interactive-column/streak/streak";
import XpLevel from "@/components/interactive-column/xp-level";
import BadgesCard from "@/components/interactive-column/badges";
import ThemeToggle from "@/components/theme-toggle";
import { getMyStatsService, type MyStats } from "@/services/engagement.service";
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

export default function ProfilePage() {
  const { logout } = useAuth();
  const [user, setUser] = useState<StoredUser>({});
  const [stats, setStats] = useState<MyStats | null>(null);

  useEffect(() => {
    setUser(readUser());
    let mounted = true;
    getMyStatsService().then((d) => {
      if (mounted && d) setStats(d);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const avatar = user.profile_pic ? resolveAvatarUrl(user.profile_pic) : null;
  const isAdmin = user.profile === ADMIN_PROFILE;

  const statCards: { label: string; value: string | number }[] = [
    { label: "XP total", value: stats?.xp ?? 0 },
    { label: "Mejor racha", value: `${stats?.bestStreak ?? 0} días` },
    { label: "Lecturas", value: stats?.readingsCompleted ?? 0 },
    { label: "Escudos", value: `❄️ ${stats?.streakFreezes ?? 0}` },
  ];

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

      {/* Tarjeta de perfil */}
      <div className="dots-card flex flex-col items-center gap-3 p-6 text-center">
        <div className="relative h-24 w-24 shrink-0">
          {avatar ? (
            <div className="relative h-full w-full overflow-hidden rounded-full ring-3 ring-(--accent)/50">
              <Image src={avatar} alt="Foto de perfil" fill style={{ objectFit: "cover" }} />
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-full bg-background p-2 ring-3 ring-(--border)">
              <Doty pose="06" size="tiny" animation="bob" />
            </div>
          )}
        </div>
        <h2 className="font-display text-xl font-extrabold text-foreground">
          {user.name || "Aprendiz"} {user.last_name || ""}
        </h2>
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
