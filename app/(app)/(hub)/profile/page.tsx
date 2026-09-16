"use client";

import { useEffect, useState } from "react";

import AvatarPicker from "@/components/profile/avatar-picker";
import BadgesGrid from "@/components/profile/badges-grid";
import GesturesCard from "@/components/profile/gestures-card";
import ProfileIdentity from "@/components/profile/profile-identity";
import ProfileStats from "@/components/profile/profile-stats";
import ProfileXpBar from "@/components/profile/profile-xp-bar";
import SettingsSheet from "@/components/profile/settings-sheet";
import type { PublicAvatar } from "@/lib/avatar";
import { gestureAnimation } from "@/lib/avatar-flip";
import { equippedGesture } from "@/lib/profile-view";
import {
  getMyBadgesService,
  getMyStatsService,
  type Badge,
  type MyStats,
} from "@/services/engagement.service";
import { getMySettingsService, postMyAvatarService } from "@/services/settings.service";
import {
  equipItemService,
  getInventoryService,
  getShopService,
  type InventoryItem,
  type ShopItem,
} from "@/services/shop.service";
import { ADMIN_PROFILE } from "@/constants";
import { useAuth } from "@/context/auth-context";

/**
 * Perfil (spec §5, variante A "identidad abierta"). Los ajustes viven en una
 * hoja, no en una tarjeta de la página. La foto `profile_pic` deja de
 * mostrarse: la cara es siempre el avatar elegido (la columna se conserva en
 * la base).
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
  const [avatar, setAvatar] = useState<PublicAvatar | null>(null);
  const [avatarKey, setAvatarKey] = useState<string | null>(null);
  const [avatarItems, setAvatarItems] = useState<ShopItem[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  // El giro de entrada de la carta espera a que respondan ajustes (avatar) e
  // inventario (gesto): si girara con el clásico y luego llegara el retrato
  // real, cambiaría de cara a media vuelta.
  const [settingsResolved, setSettingsResolved] = useState(false);
  const [inventoryResolved, setInventoryResolved] = useState(false);

  useEffect(() => {
    let active = true;
    getMyStatsService().then((d) => {
      if (active && d) setStats(d);
    });
    getMyBadgesService().then((b) => {
      if (active) setBadges(b);
    });
    getInventoryService()
      .then((inv) => {
        if (active) setInventory(inv.items);
      })
      .finally(() => {
        if (active) setInventoryResolved(true);
      });
    getMySettingsService()
      .then((s) => {
        if (active && s) {
          setAvatar(s.avatar);
          // Sin key equipada el backend igual resuelve "clasico" en perfil, ranking
          // y aviso de rival: mismo fallback aquí para que selector y tienda coincidan.
          setAvatarKey(s.avatar_key ?? "clasico");
        }
      })
      .finally(() => {
        if (active) setSettingsResolved(true);
      });
    getShopService().then((shop) => {
      if (active) {
        setAvatarItems(shop.items.filter((i) => i.kind === "avatar" && (i.price === 0 || i.owned)));
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const toggleEquip = (item: InventoryItem) => {
    equipItemService(item.id, item.equippedSlot === null).then((inv) => setInventory(inv.items));
  };

  // Si falla (avatar de pago no comprado, por ejemplo) cierra igual y no
  // cambia nada: comprarlo es cosa de la tienda, no de este selector.
  const pick = (key: string) => {
    postMyAvatarService(key)
      .then((a) => {
        setAvatar(a);
        setAvatarKey(key);
        setPickerOpen(false);
      })
      .catch(() => {
        setPickerOpen(false);
      });
  };

  const name = [user.name, user.last_name].filter(Boolean).join(" ") || "Aprendiz";
  const gesture = gestureAnimation(equippedGesture(inventory));
  const ready = settingsResolved && inventoryResolved;

  return (
    <>
      <div className="flex flex-col gap-6 md:grid md:grid-cols-2 md:items-start md:gap-8">
        <div className="flex flex-col gap-5">
          <ProfileIdentity
            name={name}
            stats={stats}
            avatar={avatar}
            gesture={gesture}
            ready={ready}
            onChangeAvatar={() => setPickerOpen(true)}
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
        onChangeAvatar={() => setPickerOpen(true)}
      />

      <AvatarPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        items={avatarItems}
        currentKey={avatarKey}
        onPick={pick}
      />
    </>
  );
}
