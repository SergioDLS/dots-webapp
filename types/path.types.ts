export type PathNodeType =
  | "practice"
  | "pronunciation"
  | "grammar"
  | "vocab"
  | "checkpoint";

export type PathNode = {
  id: number;
  type: PathNodeType;
  position: number;
  title: string;
  sectionId: number;
  levelId?: number;
  src?: string | null;
  itemCount?: number;
  progress: number;
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
