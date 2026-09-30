import type { PathNode, PathNodeType } from "@/types/path.types";

/**
 * Hitos de la barra de cada nivel del Camino (spec 2026-09-30 §Hitos). Son los
 * dos logros de siempre, los que antes marcaba el check de la esquina:
 * *completado* (respondiste todo una vez) y *dominado* (mastery 100, solo en
 * los módulos con dominio por ítem).
 *
 * Lógica pura, solo `import type`: `node --test` la ejecuta tal cual.
 */

/** Módulos con dominio por ítem (F3e): los únicos con segundo tramo. */
export const MASTERY_TYPES: ReadonlySet<PathNodeType> = new Set<PathNodeType>([
  "letters",
  "numbers",
  "vocab",
  "pronunciation",
  "grammar",
]);

export type MilestoneKind = "complete" | "master";
export type MilestoneTone = "accent" | "success" | "gold";

export type MilestoneLeg = {
  kind: MilestoneKind;
  /** Cuánto del tramo está lleno, 0–100. */
  fill: number;
  tone: MilestoneTone;
  /** El hito del final del tramo ya se alcanzó. */
  reached: boolean;
};

const clamp = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));

export function nodeMilestones(
  node: Pick<PathNode, "type" | "progress" | "completed" | "mastery">,
): MilestoneLeg[] {
  if (node.type === "checkpoint") return [];
  const done = node.completed;
  const legs: MilestoneLeg[] = [
    {
      kind: "complete",
      fill: done ? 100 : clamp(node.progress),
      tone: done ? "success" : "accent",
      reached: done,
    },
  ];
  if (MASTERY_TYPES.has(node.type)) {
    // Tal cual viene, aunque el primer tramo no esté lleno: se pueden dominar
    // ítems antes de terminar la pasada, y es un dato real.
    const fill = clamp(node.mastery ?? 0);
    legs.push({ kind: "master", fill, tone: fill >= 100 ? "gold" : "accent", reached: fill >= 100 });
  }
  return legs;
}

export const MILESTONE_LABEL: Record<MilestoneKind, string> = {
  complete: "Completado",
  master: "Dominado",
};

/** Lo que lee un lector de pantalla: «Completado al 40 %. Dominado al 0 %.» */
export function milestonesLabel(legs: readonly MilestoneLeg[]): string {
  return legs.map((l) => `${MILESTONE_LABEL[l.kind]} al ${l.fill} %.`).join(" ");
}
