import type { IconName } from "@/components/ui/icon";
import type { PathNode, PathNodeType } from "@/types/path.types";

type NodeMeta = {
  icon: IconName;
  label: string;
  route: (node: PathNode) => string;
};

export const NODE_META: Record<PathNodeType, NodeMeta> = {
  practice:      { icon: "leccion",     label: "Lección",     route: (n) => `/practice?id=${n.levelId ?? n.id}` },
  pronunciation: { icon: "escucha",     label: "Escucha",     route: (n) => `/lesson/pronunciation?id=${n.id}` },
  grammar:       { icon: "gramatica",   label: "Gramática",   route: (n) => `/lesson/grammar?id=${n.id}` },
  vocab:         { icon: "vocabulario", label: "Vocabulario", route: (n) => `/lesson/vocab?id=${n.id}` },
  letters:       { icon: "letras",      label: "Letras",      route: (n) => `/lesson/letters?id=${n.id}` },
  numbers:       { icon: "numeros",     label: "Números",     route: (n) => `/lesson/numbers?id=${n.id}` },
  reading:       { icon: "lectura",     label: "Lectura",     route: (n) => `/readings/${n.readingId ?? n.id}` },
  checkpoint:    { icon: "checkpoint",  label: "Checkpoint",  route: (n) => `/checkpoint?id=${n.sectionId}` },
};
