export type SentenceOption = {
  id: number;
  word: string;
  correct: boolean;
  img?: string;
  img_sound?: string;
  selected?: boolean;
  order?: number;
};

export type Sentence = {
  id: number;
  text: string;
  mode: string;
  img?: string;
  img_sound?: string;
  sentence_extension?: string;
  options: SentenceOption[];
};

/** Practice-session enrichment: per-run answer tracking on top of Sentence */
export type PracticeSentence = Sentence & {
  answered?: boolean;
  times_wrong: number;
};
