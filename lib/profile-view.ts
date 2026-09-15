import type { Badge, MyStats } from "@/services/engagement.service";
import type { InventoryItem } from "@/services/shop.service";

/**
 * Lógica pura del perfil (spec §5). Vive fuera de los componentes para poder
 * probarse con `node --test`: por eso SOLO admite `import type` (Node ejecuta
 * este archivo sin bundler y no resolvería el alias `@/`).
 */

/** Banda MCER estimada por nivel de XP. Los umbrales son los que ya usaba el perfil. */
export function cefrBand(level: number): { code: string; name: string } {
  if (level <= 2) return { code: "A1", name: "Principiante" };
  if (level <= 4) return { code: "A2", name: "Básico" };
  if (level <= 7) return { code: "B1", name: "Intermedio" };
  if (level <= 10) return { code: "B2", name: "Intermedio alto" };
  if (level <= 14) return { code: "C1", name: "Avanzado" };
  return { code: "C2", name: "Experto" };
}

export function badgeCounts(badges: Badge[]): { earned: number; total: number } {
  return { earned: badges.filter((b) => b.earned).length, total: badges.length };
}

/** "Nivel 4 · 620 / 900 XP" (spec §5). Con stats ausentes da una línea neutra. */
export function levelLine(stats: MyStats | null): string {
  const level = stats?.level ?? 1;
  const xp = stats?.xp ?? 0;
  const next = stats?.xpForNextLevel ?? 0;
  return `Nivel ${level} · ${xp} / ${next} XP`;
}

export interface StatItem {
  label: string;
  value: string;
}

/**
 * Los cuatro números del spec §5, en orden. `gems` es opcional en el contrato
 * del backend (puede faltar si la economía no se migró) y las insignias llegan
 * de otro endpoint, así que ambos caen a cero en vez de pintar "undefined".
 */
export function statRow(stats: MyStats | null, badges: Badge[]): StatItem[] {
  const { earned, total } = badgeCounts(badges);
  return [
    { label: "XP total", value: String(stats?.xp ?? 0) },
    { label: "Mejor racha", value: String(stats?.bestStreak ?? 0) },
    { label: "Insignias", value: `${earned}/${total}` },
    { label: "Gemas", value: String(stats?.gems ?? 0) },
  ];
}

/** Gestos del inventario. Gorros y fondos dejan de pintarse en D (spec §5). */
export function gestureItems(items: InventoryItem[]): InventoryItem[] {
  return items.filter((i) => i.slot === "gesture");
}

/** El gesto puesto, o null. Un equipado de otro slot no cuenta. */
export function equippedGesture(items: InventoryItem[]): InventoryItem | null {
  return items.find((i) => i.slot === "gesture" && i.equippedSlot === "gesture") ?? null;
}
