export type Level = {
  id: number;
  name: string;
  src: string;
  on_construction: number;
  available: boolean;
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
  enabled: number;
  name: string;
  sections: Array<SectionLevel>;
  progress: number;
};
