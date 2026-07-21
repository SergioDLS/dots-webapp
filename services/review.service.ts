import api from "@/lib/api-client";

export type ReviewOption = { word: string; correct: boolean };

export type ReviewQuestion = {
  kind: "sentence";
  refId: number;
  sentenceId: number;
  text: string;
  options: ReviewOption[];
};

export type ReviewSession = {
  items: ReviewQuestion[];
  total: number;
  dueCount: number;
};

export type ReviewResult = { kind: string; refId: number; correct: boolean };

export type ReviewSubmitResponse = {
  reviewed: number;
  xpGained: number;
  xp: number;
  streak: number;
  streakUp: boolean;
  freezeUsed?: boolean;
  freezeEarned?: boolean;
};

export const getReviewSessionService = async (): Promise<ReviewSession> => {
  const res = await api.get<ReviewSession>("/review/session");
  return res.data;
};

export const submitReviewService = async (
  results: ReviewResult[],
): Promise<ReviewSubmitResponse> => {
  const res = await api.put<ReviewSubmitResponse>("/review/session", {
    results,
  });
  return res.data;
};
