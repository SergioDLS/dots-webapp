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

export type AdminReadingListItem = {
  id: number;
  title: string;
  unlock: number;
  enabled: boolean;
  hasAudio: boolean;
};

export type AdminReading = {
  id: number;
  title: string;
  text: string;
  src: string;
  unlock: number;
  enabled: boolean;
};

export type AdminUser = {
  id: number;
  name: string;
  lastName: string;
  email: string;
  username: string;
  profile: number;
  blocked: boolean;
  birth: string | null;
  creationDate: string | null;
  expires: string | null;
  lastLog: string | null;
  xp: number;
  streak: number;
  profilePic: string | null;
};

// ── Words ──────────────────────────────────────────────────────

export async function createWord(payload: {
  levelId: number;
  text: string;
  meaning?: string;
  audio?: string;
  img?: string;
  position?: number;
}): Promise<AdminWord> {
  const { data } = await api.post("/admin/words", payload);
  return data;
}

export async function updateWord(
  id: number,
  payload: Partial<{
    text: string;
    meaning: string;
    audio: string;
    img: string;
    position: number;
  }>,
): Promise<AdminWord> {
  const { data } = await api.patch(`/admin/words/${id}`, payload);
  return data;
}

export async function deleteWord(id: number) {
  const { data } = await api.delete(`/admin/words/${id}`);
  return data;
}

// ── Readings ───────────────────────────────────────────────────

export async function getReadings(): Promise<AdminReadingListItem[]> {
  const { data } = await api.get("/admin/readings");
  return data;
}

export async function getReading(id: number): Promise<AdminReading> {
  const { data } = await api.get(`/admin/readings/${id}`);
  return data;
}

export async function createReading(payload: {
  title: string;
  text: string;
  src?: string;
  unlock?: number;
}): Promise<AdminReading> {
  const { data } = await api.post("/admin/readings", payload);
  return data;
}

export async function updateReading(
  id: number,
  payload: Partial<{
    title: string;
    text: string;
    src: string;
    unlock: number;
  }>,
): Promise<AdminReading> {
  const { data } = await api.patch(`/admin/readings/${id}`, payload);
  return data;
}

export async function setReadingEnabled(id: number, enabled: boolean) {
  const { data } = await api.patch(`/admin/readings/${id}/enabled`, {
    enabled,
  });
  return data;
}

// ── Users ──────────────────────────────────────────────────────

export async function getUsers(): Promise<AdminUser[]> {
  const { data } = await api.get("/admin/users");
  return data;
}

export async function updateUser(
  id: number,
  payload: Partial<{
    name: string;
    lastName: string;
    email: string;
    birth: string | null;
    expires: string | null;
  }>,
): Promise<AdminUser> {
  const { data } = await api.patch(`/admin/users/${id}`, payload);
  return data;
}

export async function setUserBlocked(id: number, blocked: boolean) {
  const { data } = await api.patch(`/admin/users/${id}/blocked`, { blocked });
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

// ── Levels (create / update) ───────────────────────────────────

export async function createLevel(payload: {
  name: string;
  idSection: number;
  src?: string;
  unlock?: number;
}): Promise<AdminLevel & { idSection: number | null; unlock: number }> {
  const { data } = await api.post("/admin/levels", payload);
  return data;
}

export async function updateLevel(
  id: number,
  payload: Partial<{
    name: string;
    src: string;
    idSection: number;
    unlock: number;
    onConstruction: boolean;
    enabled: boolean;
  }>,
): Promise<AdminLevel & { idSection: number | null; unlock: number }> {
  const { data } = await api.patch(`/admin/levels/${id}`, payload);
  return data;
}

// ── Foundations: pronunciation ─────────────────────────────────

export type AdminPronunciationUnit = {
  id: number;
  key: string;
  title: string;
  descriptionEs: string;
  soundA: string;
  soundB: string;
  enabled: boolean;
};

export type AdminPronunciationItem = {
  id: number;
  unitId: number;
  wordA: string;
  wordB: string;
  audioA: string;
  audioB: string;
  position: number;
  enabled: boolean;
};

export async function getPronunciationUnits(): Promise<
  AdminPronunciationUnit[]
> {
  const { data } = await api.get("/admin/pronunciation-units");
  return data;
}

export async function createPronunciationUnit(payload: {
  key: string;
  title: string;
  descriptionEs?: string;
  soundA?: string;
  soundB?: string;
}): Promise<AdminPronunciationUnit> {
  const { data } = await api.post("/admin/pronunciation-units", payload);
  return data;
}

export async function updatePronunciationUnit(
  id: number,
  payload: Partial<{
    title: string;
    descriptionEs: string;
    soundA: string;
    soundB: string;
    enabled: boolean;
  }>,
): Promise<AdminPronunciationUnit> {
  const { data } = await api.patch(`/admin/pronunciation-units/${id}`, payload);
  return data;
}

export async function deletePronunciationUnit(id: number) {
  const { data } = await api.delete(`/admin/pronunciation-units/${id}`);
  return data;
}

export async function getPronunciationItems(
  unitId: number,
): Promise<AdminPronunciationItem[]> {
  const { data } = await api.get(`/admin/pronunciation-units/${unitId}/items`);
  return data;
}

export async function createPronunciationItem(payload: {
  unitId: number;
  wordA: string;
  wordB: string;
  position?: number;
}): Promise<AdminPronunciationItem> {
  const { data } = await api.post("/admin/pronunciation-items", payload);
  return data;
}

export async function updatePronunciationItem(
  id: number,
  payload: Partial<{
    wordA: string;
    wordB: string;
    position: number;
    enabled: boolean;
  }>,
): Promise<AdminPronunciationItem> {
  const { data } = await api.patch(`/admin/pronunciation-items/${id}`, payload);
  return data;
}

export async function deletePronunciationItem(id: number) {
  const { data } = await api.delete(`/admin/pronunciation-items/${id}`);
  return data;
}

export async function generatePronunciationAudio(
  id: number,
  characterId?: number,
) {
  const { data } = await api.post(
    `/admin/pronunciation-items/${id}/generate-audio`,
    characterId != null ? { characterId } : {},
  );
  return data;
}

// ── Foundations: grammar ───────────────────────────────────────

export type GrammarBlock = {
  type: "p" | "example" | "tip";
  text: string;
  en?: string;
};

export type AdminGrammarPill = {
  id: number;
  key: string;
  title: string;
  explanation: GrammarBlock[];
  enabled: boolean;
};

export type AdminGrammarItem = {
  id: number;
  pillId: number;
  text: string;
  answer: string;
  distractors: string[];
  mode: "complete" | "select";
  position: number;
  enabled: boolean;
};

export async function getGrammarPills(): Promise<AdminGrammarPill[]> {
  const { data } = await api.get("/admin/grammar-pills");
  return data;
}

export async function createGrammarPill(payload: {
  key: string;
  title: string;
  explanation: GrammarBlock[];
}): Promise<AdminGrammarPill> {
  const { data } = await api.post("/admin/grammar-pills", payload);
  return data;
}

export async function updateGrammarPill(
  id: number,
  payload: Partial<{
    title: string;
    explanation: GrammarBlock[];
    enabled: boolean;
  }>,
): Promise<AdminGrammarPill> {
  const { data } = await api.patch(`/admin/grammar-pills/${id}`, payload);
  return data;
}

export async function deleteGrammarPill(id: number) {
  const { data } = await api.delete(`/admin/grammar-pills/${id}`);
  return data;
}

export async function getGrammarItems(
  pillId: number,
): Promise<AdminGrammarItem[]> {
  const { data } = await api.get(`/admin/grammar-pills/${pillId}/items`);
  return data;
}

export async function createGrammarItem(payload: {
  pillId: number;
  text: string;
  answer: string;
  distractors: string[];
  mode?: "complete" | "select";
  position?: number;
}): Promise<AdminGrammarItem> {
  const { data } = await api.post("/admin/grammar-items", payload);
  return data;
}

export async function updateGrammarItem(
  id: number,
  payload: Partial<{
    text: string;
    answer: string;
    distractors: string[];
    mode: "complete" | "select";
    position: number;
    enabled: boolean;
  }>,
): Promise<AdminGrammarItem> {
  const { data } = await api.patch(`/admin/grammar-items/${id}`, payload);
  return data;
}

export async function deleteGrammarItem(id: number) {
  const { data } = await api.delete(`/admin/grammar-items/${id}`);
  return data;
}

// ── Foundations: vocab ─────────────────────────────────────────

export type AdminVocabPack = {
  id: number;
  key: string;
  title: string;
  enabled: boolean;
};

export type AdminVocabItem = {
  id: number;
  packId: number;
  text: string;
  meaning: string;
  img: string;
  audio: string;
  position: number;
  enabled: boolean;
};

export async function getVocabPacks(): Promise<AdminVocabPack[]> {
  const { data } = await api.get("/admin/vocab-packs");
  return data;
}

export async function createVocabPack(payload: {
  key: string;
  title: string;
}): Promise<AdminVocabPack> {
  const { data } = await api.post("/admin/vocab-packs", payload);
  return data;
}

export async function updateVocabPack(
  id: number,
  payload: Partial<{ title: string; enabled: boolean }>,
): Promise<AdminVocabPack> {
  const { data } = await api.patch(`/admin/vocab-packs/${id}`, payload);
  return data;
}

export async function deleteVocabPack(id: number) {
  const { data } = await api.delete(`/admin/vocab-packs/${id}`);
  return data;
}

export async function getVocabItems(
  packId: number,
): Promise<AdminVocabItem[]> {
  const { data } = await api.get(`/admin/vocab-packs/${packId}/items`);
  return data;
}

export async function createVocabItem(payload: {
  packId: number;
  text: string;
  meaning?: string;
  img?: string;
  position?: number;
}): Promise<AdminVocabItem> {
  const { data } = await api.post("/admin/vocab-items", payload);
  return data;
}

export async function updateVocabItem(
  id: number,
  payload: Partial<{
    text: string;
    meaning: string;
    img: string;
    position: number;
    enabled: boolean;
  }>,
): Promise<AdminVocabItem> {
  const { data } = await api.patch(`/admin/vocab-items/${id}`, payload);
  return data;
}

export async function deleteVocabItem(id: number) {
  const { data } = await api.delete(`/admin/vocab-items/${id}`);
  return data;
}

export async function generateVocabAudio(id: number, characterId?: number) {
  const { data } = await api.post(
    `/admin/vocab-items/${id}/generate-audio`,
    characterId != null ? { characterId } : {},
  );
  return data;
}

// ── Path nodes (the learning path / camino) ────────────────────

export type PathNodeType =
  | "practice"
  | "pronunciation"
  | "grammar"
  | "vocab"
  | "reading"
  | "checkpoint";

export type AdminPathNode = {
  id: number;
  sectionId: number;
  position: number;
  type: PathNodeType;
  refId: number | null;
  title: string;
  enabled: boolean;
};

export async function getSectionNodes(
  sectionId: number,
): Promise<AdminPathNode[]> {
  const { data } = await api.get(`/admin/sections/${sectionId}/nodes`);
  return data;
}

export async function createPathNode(payload: {
  sectionId: number;
  position: number;
  type: PathNodeType;
  refId?: number | null;
  title?: string;
}): Promise<AdminPathNode> {
  const { data } = await api.post("/admin/path-nodes", payload);
  return data;
}

export async function updatePathNode(
  id: number,
  payload: Partial<{
    sectionId: number;
    position: number;
    type: PathNodeType;
    refId: number | null;
    title: string;
    enabled: boolean;
  }>,
): Promise<AdminPathNode> {
  const { data } = await api.patch(`/admin/path-nodes/${id}`, payload);
  return data;
}

export async function deletePathNode(id: number) {
  const { data } = await api.delete(`/admin/path-nodes/${id}`);
  return data;
}
