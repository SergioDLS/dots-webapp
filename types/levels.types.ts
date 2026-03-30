export type Level = {
  id: number;
  name: string;
  src: string;
  idSection: 1;
  onConstruction: boolean;
  enabled: boolean;
  unlock: number;
  unlocked: boolean;
};

export type SectionLevel = {
  id: number;
  name: string;
  levels: Array<Level>;
};

export type Difficulty = {
  id: number;
  img: string;
  enabled: number;
  name: string;
  sections: Array<SectionLevel>;
};
