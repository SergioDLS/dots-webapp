export type PathNodeType =
  | "practice"
  | "pronunciation"
  | "grammar"
  | "vocab"
  | "letters"
  | "numbers"
  | "reading"
  | "checkpoint";

export type PathNode = {
  id: number;
  type: PathNodeType;
  position: number;
  title: string;
  sectionId: number;
  levelId?: number;
  readingId?: number;
  src?: string | null;
  itemCount?: number;
  progress: number;
  /** % de ítems dominados (corona al llegar a 100). Solo módulos con ítems. */
  mastery?: number;
  completed: boolean;
  unlocked: boolean;
  current: boolean;
};

export type PathSection = {
  id: number;
  name: string;
  progress: number;
  skipped: boolean;
  unlocked: boolean;
  current: boolean;
  checkpointAvailable: boolean;
  nodes: PathNode[];
};

export type PathDifficulty = {
  id: number;
  name: string;
  img?: string | null;
  progress: number;
  skipped: boolean;
  current: boolean;
  sections: PathSection[];
};

export type PathResponse = {
  placementPending: boolean;
  difficulties: PathDifficulty[];
};
