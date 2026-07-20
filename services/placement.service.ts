import api from "@/lib/api-client";

// Frozen backend contracts — src/modules/placement (dots-backend).

export type PlacementStatus = {
  status: "none" | "active" | "done" | "skipped";
  canTake: boolean;
};

export type PlacementQuestion = {
  sentenceId: number;
  text: string;
  options: string[];
};

export type PlacementStart = {
  testId: number;
  questionNumber: number;
  maxQuestions: number;
  question: PlacementQuestion;
};

export type PlacementResult = {
  placedAtDifficultyId: number;
  placedAtDifficultyName: string;
  skippedDifficulties: number;
  startFromZero: boolean;
};

export type PlacementAnswerResponse = {
  correct: boolean;
  finished: boolean;
  questionNumber?: number;
  question?: PlacementQuestion;
  result?: PlacementResult;
};

export const getPlacementStatusService = async (): Promise<PlacementStatus> => {
  const res = await api.get<PlacementStatus>("/placement/status");
  return res.data;
};

export const skipPlacementService = async (): Promise<{ ok: true }> => {
  const res = await api.post<{ ok: true }>("/placement/skip");
  return res.data;
};

export const startPlacementService = async (): Promise<PlacementStart> => {
  const res = await api.post<PlacementStart>("/placement/start");
  return res.data;
};

export const answerPlacementService = async (
  testId: number,
  sentenceId: number,
  word: string,
): Promise<PlacementAnswerResponse> => {
  const res = await api.post<PlacementAnswerResponse>("/placement/answer", {
    testId,
    sentenceId,
    word,
  });
  return res.data;
};
