"use client";

import { useEffect, useState } from "react";

import BadgesGrid from "@/components/profile/badges-grid";
import GesturesCard from "@/components/profile/gestures-card";
import ProfileIdentity from "@/components/profile/profile-identity";
import ProfileStats from "@/components/profile/profile-stats";
import ProfileXpBar from "@/components/profile/profile-xp-bar";
import SettingsSheet from "@/components/profile/settings-sheet";
import type { DotyAnimation } from "@/components/ui/doty/doty";
import { equippedGesture } from "@/lib/profile-view";
import {
  getMyBadgesService,
  getMyStatsService,
  type Badge,
  type MyStats,
} from "@/services/engagement.service";
import {
  equipItemService,
  getInventoryService,
  type InventoryItem,
} from "@/services/shop.service";
import { ADMIN_PROFILE } from "@/constants";
import { useAuth } from "@/context/auth-context";

/**
 * Perfil (spec §5, variante A "identidad abierta"). Los ajustes viven en una
 * hoja, no en una tarjeta de la página. La foto `profile_pic` deja de
 * mostrarse: la cara es siempre Doty (la columna se conserva en la base).
 */

type StoredUser = { name?: string; last_name?: string; profile?: number };

function readUser(): StoredUser {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}") || {};
  } catch {
    return {};
  }
}

export default function ProfilePage() {
  const { logout } = useAuth();
  const [user] = useState<StoredUser>(readUser);
  const [stats, setStats] = useState<MyStats | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    let active = true;
    getMyStatsService().then((d) => {
      if (active && d) setStats(d);
    });
    getMyBadgesService().then((b) => {
      if (active) setBadges(b);
    });
    getInventoryService().then((inv) => {
      if (active) setInventory(inv.items);
    });
    return () => {
      active = false;
    };
  }, []);

  const toggleEquip = (item: InventoryItem) => {
    equipItemService(item.id, item.equippedSlot === null).then((inv) => setInventory(inv.items));
  };

  const name = [user.name, user.last_name].filter(Boolean).join(" ") || "Aprendiz";
  const gesture = equippedGesture(inventory);
  const gestureAnimation = gesture?.meta?.animation as DotyAnimation | undefined;

  return (
    <>
      <div className="flex flex-col gap-6 md:grid md:grid-cols-2 md:items-start md:gap-8">
        <div className="flex flex-col gap-5">
          <ProfileIdentity
            name={name}
            stats={stats}
            gestureAnimation={gestureAnimation}
            onOpenSettings={() => setSettingsOpen(true)}
          />
          <ProfileXpBar stats={stats} />
          <ProfileStats stats={stats} badges={badges} />
        </div>

        <div className="flex flex-col gap-6">
          <BadgesGrid badges={badges} />
          <GesturesCard items={inventory} onToggle={toggleEquip} />
        </div>
      </div>

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        isAdmin={user.profile === ADMIN_PROFILE}
        onLogout={() => void logout()}
      />
    </>
  );
}
