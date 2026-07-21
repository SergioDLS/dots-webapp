import api from "@/lib/api-client";

export type ShopItem = {
  id: number;
  key: string;
  kind: "streak_shield" | "xp_boost" | "cosmetic" | "gesture";
  name: string;
  description: string | null;
  price: number;
  slot: string | null;
  meta: Record<string, unknown> | null;
  owned: boolean;
};

export type Shop = { balance: number; items: ShopItem[] };

export type InventoryItem = {
  id: number;
  key: string;
  kind: string;
  name: string;
  slot: string | null;
  meta: Record<string, unknown> | null;
  equippedSlot: string | null;
};

export type Inventory = { items: InventoryItem[] };

export const getShopService = async (): Promise<Shop> => {
  try {
    const res = await api.get<Shop>("/shop");
    return res.data;
  } catch {
    return { balance: 0, items: [] };
  }
};

export const buyItemService = async (
  key: string,
): Promise<{ balance: number; granted: string }> => {
  const res = await api.post<{ balance: number; granted: string }>(
    "/shop/buy",
    { key },
  );
  return res.data;
};

export const getInventoryService = async (): Promise<Inventory> => {
  try {
    const res = await api.get<Inventory>("/shop/inventory");
    return res.data;
  } catch {
    return { items: [] };
  }
};

export const equipItemService = async (
  itemId: number,
  equip: boolean,
): Promise<Inventory> => {
  const res = await api.post<Inventory>("/shop/equip", { itemId, equip });
  return res.data;
};
