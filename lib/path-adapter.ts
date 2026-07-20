import type { Difficulty } from "@/types/levels.types";
import type { PathNode, PathResponse } from "@/types/path.types";

/**
 * Adapts the legacy GET /levels payload to the GET /path contract so the
 * path UI works before the new backend endpoint is deployed.
 * Each Level becomes a "practice" node; every section is closed by a
 * synthetic LOCKED checkpoint node (no checkpoint backend yet).
 */
export function adaptLevelsToPath(difficulties: Difficulty[]): PathResponse {
  return {
    placementPending: false,
    difficulties: (difficulties ?? []).map((d) => ({
      id: d.id,
      name: d.name,
      img: d.img ?? null,
      progress: d.progress ?? 0,
      skipped: false,
      current: d.current ?? false,
      sections: (d.sections ?? []).map((s) => {
        const nodes: PathNode[] = (s.levels ?? []).map((lvl, i) => {
          const progress = Math.max(0, Math.min(100, Math.round(lvl.progress ?? 0)));
          return {
            id: lvl.id,
            type: "practice",
            position: i,
            title: lvl.name,
            sectionId: s.id,
            levelId: lvl.id,
            src: lvl.src ?? null,
            progress,
            completed: progress >= 100,
            unlocked: lvl.unlocked ?? true,
            current: lvl.current ?? false,
          };
        });

        // Synthetic checkpoint: negative id so it never collides with a level id
        nodes.push({
          id: -s.id,
          type: "checkpoint",
          position: nodes.length,
          title: "Checkpoint",
          sectionId: s.id,
          src: null,
          progress: 0,
          completed: false,
          unlocked: false,
          current: false,
        });

        return {
          id: s.id,
          name: s.name,
          progress: s.progress ?? 0,
          skipped: false,
          unlocked: nodes.some((n) => n.unlocked),
          current: false,
          checkpointAvailable: false,
          nodes,
        };
      }),
    })),
  };
}
