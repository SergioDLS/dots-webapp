import api from "../lib/api-client";

export type AdminDifficulty = {
  id: number;
  name: string;
  img?: string | null;
  enabled: boolean;
};

export type AdminLevel = {
  id: number;
  name: string;
  src: string;
  enabled: boolean;
  onConstruction: boolean;
};

export type AdminSection = {
  id: number;
  name: string;
  levels: AdminLevel[];
};

export type AdminStructure = {
  id: number;
  name: string;
  sections: AdminSection[];
};

export type AdminSentence = {
  id: number;
  text: string;
  mWord: string;
  levelId: number | null;
  img: string;
  imgSound: string;
  enabled: boolean;
  sentenceExtension: string;
};

export type AdminWord = {
  id: number;
  text?: string | null;
  meaning?: string | null;
  audio?: string | null;
  img?: string | null;
  position?: number | null;
};

export async function getDifficulties(): Promise<AdminDifficulty[]> {
  const { data } = await api.get("/admin/difficulties");
  return data;
}

export async function getStructure(
  difficultyId: number,
): Promise<AdminStructure> {
  const { data } = await api.get(`/admin/difficulties/${difficultyId}/structure`);
  return data;
}

export async function setLevelEnabled(id: number, enabled: boolean) {
  const { data } = await api.patch(`/admin/levels/${id}/enabled`, { enabled });
  return data;
}

export async function getSentences(levelId: number): Promise<AdminSentence[]> {
  const { data } = await api.get(`/admin/levels/${levelId}/sentences`);
  return data;
}

export async function getWords(levelId: number): Promise<AdminWord[]> {
  const { data } = await api.get(`/admin/levels/${levelId}/words`);
  return data;
}

export async function createSentence(payload: {
  levelId: number;
  text: string;
  mWord: string;
  img?: string;
  imgSound?: string;
  sentenceExtension?: string;
}): Promise<AdminSentence> {
  const { data } = await api.post("/admin/sentences", payload);
  return data;
}

export async function updateSentence(
  id: number,
  payload: Partial<{
    text: string;
    mWord: string;
    img: string;
    imgSound: string;
    sentenceExtension: string;
    enabled: boolean;
  }>,
): Promise<AdminSentence> {
  const { data } = await api.patch(`/admin/sentences/${id}`, payload);
  return data;
}

export async function setSentenceEnabled(id: number, enabled: boolean) {
  const { data } = await api.patch(`/admin/sentences/${id}/enabled`, {
    enabled,
  });
  return data;
}

export async function deleteSentence(id: number) {
  const { data } = await api.delete(`/admin/sentences/${id}`);
  return data;
}

export async function uploadMedia(
  file: File,
  kind: "image" | "audio",
): Promise<{ url: string }> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post(`/admin/upload?kind=${kind}`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}
