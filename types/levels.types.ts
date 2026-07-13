export type Level = {
  id: number;
  name: string;
  src: string;
  onConstruction: boolean;
  unlocked: boolean;
  unlock: number;
  levels_left: number;
  progress: number;
  current?: boolean;
};

export type SectionLevel = {
  id: number;
  name: string;
  levels: Array<Level>;
  progress: number;
};

export type Difficulty = {
  id: number;
  img: string;
  enabled: boolean;
  name: string;
  sections: Array<SectionLevel>;
  progress: number;
  current?: boolean;
};
