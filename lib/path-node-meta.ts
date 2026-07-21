import type { PathNode, PathNodeType } from "@/types/path.types";

type NodeMeta = {
  icon: string;
  label: string;
  route: (node: PathNode) => string;
};

export const NODE_META: Record<PathNodeType, NodeMeta> = {
  practice: {
    icon: "📖",
    label: "Lección",
    route: (n) => `/practice?id=${n.levelId ?? n.id}`,
  },
  pronunciation: {
    icon: "🔊",
    label: "Escucha",
    route: (n) => `/lesson/pronunciation?id=${n.id}`,
  },
  grammar: {
    icon: "🧩",
    label: "Gramática",
    route: (n) => `/lesson/grammar?id=${n.id}`,
  },
  vocab: {
    icon: "💬",
    label: "Vocabulario",
    route: (n) => `/lesson/vocab?id=${n.id}`,
  },
  reading: {
    icon: "📚",
    label: "Lectura",
    route: (n) => `/readings/${n.readingId ?? n.id}`,
  },
  checkpoint: {
    icon: "🏁",
    label: "Checkpoint",
    route: (n) => `/checkpoint?id=${n.sectionId}`,
  },
};
