import api from "@/lib/api-client";
import type { ProgressReward } from "./engagement.service";

// ── GET /path/nodes/:id — frozen backend contracts ───────────────────────────

export type NodeOption = { word: string; correct: boolean };

export type GrammarBlock = {
  type: "p" | "example" | "tip";
  text: string;
  en?: string;
};

export type PronunciationContent = {
  type: "pronunciation";
  title: string;
  descriptionEs?: string | null;
  soundA?: string | null;
  soundB?: string | null;
  items: { id: number; audio: string; options: NodeOption[]; hint?: string }[];
};

export type GrammarContent = {
  type: "grammar";
  title: string;
  explanation: GrammarBlock[];
  items: {
    id: number;
    mode: "complete" | "select";
    text: string;
    options: NodeOption[];
    hint?: string;
  }[];
};

export type VocabContent = {
  type: "vocab";
  title: string;
  items: {
    id: number;
    text: string;
    meaning: string;
    img?: string | null;
    audio?: string | null;
  }[];
};

export type PracticeContent = {
  type: "practice";
  title: string;
  levelId: number;
};

export type NodeContent =
  | PronunciationContent
  | GrammarContent
  | VocabContent
  | PracticeContent;

export const getNodeContentService = async (
  nodeId: number | string,
): Promise<NodeContent> => {
  const res = await api.get<NodeContent>(`/path/nodes/${nodeId}`);
  return res.data;
};

// ── PUT /path/nodes/:id/progress ──────────────────────────────────────────────

export type NodeItemResult = {
  id: number;
  times_wrong: number;
  answered: boolean;
};

export type NodeProgressReward = ProgressReward & { nodeProgress: number };

export const putNodeProgressService = async (
  nodeId: number | string,
  items: NodeItemResult[],
): Promise<NodeProgressReward> => {
  const res = await api.put<NodeProgressReward>(
    `/path/nodes/${nodeId}/progress`,
    { items },
  );
  return res.data;
};

// ── Checkpoints (section test-out) ────────────────────────────────────────────

export type CheckpointQuestion = {
  sentenceId: number;
  text: string;
  options: string[];
};

export type CheckpointStart = {
  attemptId: number;
  total: number;
  passPct: number;
  questions: CheckpointQuestion[];
};

export type CheckpointResult = {
  passed: boolean;
  correct: number;
  total: number;
  xpGained: number;
  xp: number;
  sectionSkipped: boolean;
  nextSectionId?: number;
};

export const startCheckpointService = async (
  sectionId: number | string,
): Promise<CheckpointStart> => {
  const res = await api.post<CheckpointStart>(
    `/path/sections/${sectionId}/checkpoint/start`,
  );
  return res.data;
};

export const submitCheckpointService = async (
  sectionId: number | string,
  attemptId: number,
  answers: { sentenceId: number; word: string }[],
): Promise<CheckpointResult> => {
  const res = await api.post<CheckpointResult>(
    `/path/sections/${sectionId}/checkpoint/submit`,
    { attemptId, answers },
  );
  return res.data;
};
