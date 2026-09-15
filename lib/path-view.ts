import type { PathDifficulty, PathSection } from "@/types/path.types";

/**
 * Lógica pura de la vista del Camino (spec §3): qué dificultad se muestra, sus
 * vecinas, el conteo de lecciones y las frases del narrador. Sin React ni DOM,
 * solo `import type`, para que `node --test` la ejecute tal cual.
 */

export const clampPct = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));

export type LessonCount = { done: number; total: number; pct: number };

/** Lecciones = nodos que no son checkpoint (mismo criterio que el pie del banner de hoy). */
export function countLessons(sections: readonly PathSection[]): LessonCount {
  const nodes = sections.flatMap((s) => s.nodes.filter((n) => n.type !== "checkpoint"));
  const done = nodes.filter((n) => n.completed).length;
  const total = nodes.length;
  return { done, total, pct: total === 0 ? 0 : clampPct((done / total) * 100) };
}

/** Desbloqueada = superada por test o con alguna sección abierta o superada. */
export function isDifficultyUnlocked(d: PathDifficulty): boolean {
  return d.skipped || d.sections.some((s) => s.unlocked || s.skipped);
}

export function difficultyOfCurrentNode(
  difficulties: readonly PathDifficulty[],
): PathDifficulty | undefined {
  return difficulties.find((d) => d.sections.some((s) => s.nodes.some((n) => n.current)));
}

/** Sin `?d=`: la marcada `current`; si no, la del nodo `current`; si no, la primera abierta; si no, la primera. */
export function pickDefaultDifficultyId(difficulties: readonly PathDifficulty[]): number | null {
  if (difficulties.length === 0) return null;
  const byFlag = difficulties.find((d) => d.current);
  const byNode = difficultyOfCurrentNode(difficulties);
  const firstOpen = difficulties.find(isDifficultyUnlocked);
  return (byFlag ?? byNode ?? firstOpen ?? difficulties[0]).id;
}

export type DifficultyNav = {
  index: number;
  total: number;
  prevId: number | null;
  nextId: number | null;
  /** La siguiente existe pero está bloqueada: la flecha se deshabilita (se llega por la tarjeta punteada). */
  nextLocked: boolean;
};

export function difficultyNav(difficulties: readonly PathDifficulty[], id: number): DifficultyNav {
  const index = Math.max(0, difficulties.findIndex((d) => d.id === id));
  const prev = difficulties[index - 1];
  const next = difficulties[index + 1];
  return {
    index,
    total: difficulties.length,
    prevId: prev ? prev.id : null,
    nextId: next ? next.id : null,
    nextLocked: next ? !isDifficultyUnlocked(next) : false,
  };
}

/** Índice de la primera sección aún no alcanzada (ni abierta ni superada); -1 si todas lo están. */
export function firstUpcomingSectionIndex(sections: readonly PathSection[]): number {
  return sections.findIndex((s) => !s.unlocked && !s.skipped);
}

/** Línea del narrador por umbral: docs/brand/doty-identity.md, "Frases aprobadas por momento". */
export function encouragement(pct: number): string {
  const p = clampPct(pct);
  if (p <= 0) return "Todo el mundo empezó aquí. Hasta yo.";
  if (p < 50) return "Vas con todo. Ni una lección te frena.";
  if (p < 80) return "Más de la mitad. Ya no hay vuelta atrás.";
  if (p < 100) return "Ya casi. Cierra con estilo.";
  return "Nivel dominado. +1000 de aura.";
}

/** Línea del narrador en la vista previa de una dificultad bloqueada (misma tabla). */
export const PREVIEW_LINE = "Termina la anterior y este camino se abre.";

/** Doty del sub-banner de sección: poses existentes que leen bien a 104 px, deterministas por id. */
export const SECTION_POSES = [
  "leyendo", "escribiendo", "pensando", "en-laptop", "idea",
  "escuchando", "hablando", "libro", "lapiz", "mochila",
] as const;

export function sectionPose(sectionId: number): (typeof SECTION_POSES)[number] {
  return SECTION_POSES[Math.abs(sectionId) % SECTION_POSES.length];
}

/** Narrador por posición mientras no llegue el arte de fase 4 (spec §2.3 reemplaza justo a estos tres). */
export const NARRATOR_FALLBACK = ["bienvenido", "sigue-asi", "orgulloso"] as const;

export function narratorFallback(index: number): (typeof NARRATOR_FALLBACK)[number] {
  const i = Math.min(Math.max(index, 0), NARRATOR_FALLBACK.length - 1);
  return NARRATOR_FALLBACK[i];
}

export function prettyDifficultyName(name: string): string {
  return String(name || "")
    .split(" ")
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
