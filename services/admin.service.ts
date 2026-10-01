import api from "../lib/api-client";

// ── Characters (narrators) ─────────────────────────────────────

export type AdminCharacter = {
  id: number;
  key: string;
  name: string;
  elevenlabsVoiceId?: string | null;
  img?: string | null;
  isDefault: boolean;
  enabled: boolean;
  accent?: string;
  ttsStability?: number | null;
  ttsSimilarityBoost?: number | null;
  ttsStyle?: number | null;
  ttsSpeakerBoost?: boolean | null;
  audioCount: number;
};

export async function getAdminCharacters() {
  const { data } = await api.get<AdminCharacter[]>("/admin/characters");
  return data;
}

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
  /** Personaje que narra la oración. Sin esto no se puede armar la URL de la
   *  narración: el alumno la deriva de (id, extension, voiceKey). */
  voiceCharacterId?: number | null;
  voiceKey?: string | null;
  voiceCharacterName?: string | null;
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

/**
 * El backend autonarra al crear y al cambiar `text`/`mWord`, y dice cómo salió
 * ese intento. `narration` viene ausente cuando no hubo intento (un update que
 * solo toca media), así que su presencia también marca "la ruta canónica se
 * reescribió".
 */
export type SavedSentence = AdminSentence & {
  narration?: "generated" | "failed";
};

export async function createSentence(payload: {
  levelId: number;
  text: string;
  mWord: string;
  img?: string;
  imgSound?: string;
  sentenceExtension?: string;
}): Promise<SavedSentence> {
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
): Promise<SavedSentence> {
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

// ── Invitations ────────────────────────────────────────────────

export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";

export type AdminInvitation = {
  id: number;
  email: string;
  name: string;
  lastName: string;
  token: string;
  status: InvitationStatus;
  expiresAt: string;
  accessExpires: string | null;
  invitedByName: string;
  createdAt: string;
  lastSentAt: string;
  acceptedAt: string | null;
};

export type BulkInviteResult = {
  created: string[];
  skipped: { email: string; reason: string }[];
};

export async function getInvitations(): Promise<AdminInvitation[]> {
  const { data } = await api.get("/admin/invitations");
  return data;
}

export async function createInvitation(payload: {
  email: string;
  name?: string;
  lastName?: string;
  accessExpires?: string | null;
}): Promise<AdminInvitation> {
  const { data } = await api.post("/admin/invitations", payload);
  return data;
}

export async function bulkInvitations(
  emails: string,
  accessExpires: string | null,
): Promise<BulkInviteResult> {
  const { data } = await api.post("/admin/invitations/bulk", {
    emails,
    accessExpires,
  });
  return data;
}

export async function resendInvitation(id: number): Promise<AdminInvitation> {
  const { data } = await api.post(`/admin/invitations/${id}/resend`);
  return data;
}

export async function revokeInvitation(id: number): Promise<AdminInvitation> {
  const { data } = await api.delete(`/admin/invitations/${id}`);
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
  voiceCharacterId?: number | null;
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

/**
 * @deprecated Genera Y publica de una, sin audición: usa `draftNarration` +
 * `publishNarration` para que el admin escuche la toma antes de aprobarla.
 */
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
  voiceCharacterId?: number | null;
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

/**
 * @deprecated Genera Y publica de una, sin audición: usa `draftNarration` +
 * `publishNarration` para que el admin escuche la toma antes de aprobarla.
 */
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
  | "letters"
  | "numbers"
  | "reading"
  | "checkpoint";

export type AdminPathNode = {
  id: number;
  sectionId: number;
  position: number;
  type: PathNodeType;
  refId: number | null;
  title: string;
  /** Tile del nodo en el Camino; null = hereda (practice) o icono del tipo. */
  src: string | null;
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
  src?: string | null;
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
    src: string | null;
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

// ── Modules: letters ───────────────────────────────────────────

export type AdminLetterPack = {
  id: number;
  key: string;
  title: string;
  enabled: boolean;
};

export type AdminLetterItem = {
  id: number;
  packId: number;
  letter: string;
  name: string;
  soundIpa: string;
  exampleWord: string;
  exampleMeaning: string;
  img: string;
  audio: string;
  position: number;
  enabled: boolean;
  voiceCharacterId?: number | null;
};

export async function getLetterPacks(): Promise<AdminLetterPack[]> {
  const { data } = await api.get("/admin/letter-packs");
  return data;
}

export async function createLetterPack(payload: {
  key: string;
  title: string;
}): Promise<AdminLetterPack> {
  const { data } = await api.post("/admin/letter-packs", payload);
  return data;
}

export async function updateLetterPack(
  id: number,
  payload: Partial<{ title: string; enabled: boolean }>,
): Promise<AdminLetterPack> {
  const { data } = await api.patch(`/admin/letter-packs/${id}`, payload);
  return data;
}

export async function deleteLetterPack(id: number) {
  const { data } = await api.delete(`/admin/letter-packs/${id}`);
  return data;
}

export async function getLetterItems(
  packId: number,
): Promise<AdminLetterItem[]> {
  const { data } = await api.get(`/admin/letter-packs/${packId}/items`);
  return data;
}

export async function createLetterItem(payload: {
  packId: number;
  letter: string;
  name?: string;
  soundIpa?: string;
  exampleWord?: string;
  exampleMeaning?: string;
  img?: string;
  audio?: string;
  position?: number;
}): Promise<AdminLetterItem> {
  const { data } = await api.post("/admin/letter-items", payload);
  return data;
}

export async function updateLetterItem(
  id: number,
  payload: Partial<{
    letter: string;
    name: string;
    soundIpa: string;
    exampleWord: string;
    exampleMeaning: string;
    img: string;
    audio: string;
    position: number;
    enabled: boolean;
  }>,
): Promise<AdminLetterItem> {
  const { data } = await api.patch(`/admin/letter-items/${id}`, payload);
  return data;
}

export async function deleteLetterItem(id: number) {
  const { data } = await api.delete(`/admin/letter-items/${id}`);
  return data;
}

// ── Modules: numbers ───────────────────────────────────────────

export type AdminNumberPack = {
  id: number;
  key: string;
  title: string;
  enabled: boolean;
};

export type AdminNumberItem = {
  id: number;
  packId: number;
  value: number;
  word: string;
  img: string;
  audio: string;
  position: number;
  enabled: boolean;
  voiceCharacterId?: number | null;
};

export async function getNumberPacks(): Promise<AdminNumberPack[]> {
  const { data } = await api.get("/admin/number-packs");
  return data;
}

export async function createNumberPack(payload: {
  key: string;
  title: string;
}): Promise<AdminNumberPack> {
  const { data } = await api.post("/admin/number-packs", payload);
  return data;
}

export async function updateNumberPack(
  id: number,
  payload: Partial<{ title: string; enabled: boolean }>,
): Promise<AdminNumberPack> {
  const { data } = await api.patch(`/admin/number-packs/${id}`, payload);
  return data;
}

export async function deleteNumberPack(id: number) {
  const { data } = await api.delete(`/admin/number-packs/${id}`);
  return data;
}

export async function getNumberItems(
  packId: number,
): Promise<AdminNumberItem[]> {
  const { data } = await api.get(`/admin/number-packs/${packId}/items`);
  return data;
}

export async function createNumberItem(payload: {
  packId: number;
  value: number;
  word: string;
  img?: string;
  audio?: string;
  position?: number;
}): Promise<AdminNumberItem> {
  const { data } = await api.post("/admin/number-items", payload);
  return data;
}

export async function updateNumberItem(
  id: number,
  payload: Partial<{
    value: number;
    word: string;
    img: string;
    audio: string;
    position: number;
    enabled: boolean;
  }>,
): Promise<AdminNumberItem> {
  const { data } = await api.patch(`/admin/number-items/${id}`, payload);
  return data;
}

export async function deleteNumberItem(id: number) {
  const { data } = await api.delete(`/admin/number-items/${id}`);
  return data;
}

// ── Audición de voz: borrador → escuchar → publicar ────────────

export type NarrationEntity =
  | "sentences"
  | "vocab-items"
  | "letter-items"
  | "number-items"
  | "pronunciation-items";

export type VoiceSettings = {
  stability: number;
  similarityBoost: number;
  style: number;
  useSpeakerBoost: boolean;
};

export type VoiceClip = { label?: string; url: string };

export type VoiceTake = {
  characterId: number;
  characterKey: string;
  characterName: string;
  spokenText: string;
  clips: VoiceClip[];
  voiceSettings: VoiceSettings | null;
};

/** Genera una toma en la ruta borrador. No toca lo que oye el alumno. */
export async function draftNarration(
  entity: NarrationEntity,
  id: number,
  opts: {
    characterId?: number;
    seed?: number;
    voiceSettings?: VoiceSettings | null;
  } = {},
): Promise<VoiceTake> {
  const { data } = await api.post<VoiceTake>(
    `/admin/${entity}/${id}/narration-draft`,
    {
      ...(opts.characterId != null && { characterId: opts.characterId }),
      ...(opts.seed != null && { seed: opts.seed }),
      ...(opts.voiceSettings && { voiceSettings: opts.voiceSettings }),
    },
  );
  return data;
}

/** Promueve el borrador de ese narrador a la ruta canónica. */
export async function publishNarration(
  entity: NarrationEntity,
  id: number,
  characterId: number,
): Promise<{ characterKey: string; url: string; urls: string[] }> {
  const { data } = await api.post(`/admin/${entity}/${id}/narration-publish`, {
    characterId,
  });
  return data;
}

export type CharacterVoiceSettings = VoiceSettings & {
  source: "character" | "elevenlabs";
};

/** Ajustes efectivos de un personaje. Lectura de metadata: no gasta créditos. */
export async function getCharacterVoiceSettings(characterId: number) {
  const { data } = await api.get<CharacterVoiceSettings>(
    `/admin/characters/${characterId}/voice-settings`,
  );
  return data;
}

/**
 * El backend responde con la entidad cruda que devuelve `characterRepository
 * .save()`, no con el item serializado del listado: la forma es más angosta que
 * un `AdminCharacter` — en particular NO trae `audioCount`.
 */
export async function updateCharacter(
  id: number,
  payload: Partial<{
    name: string;
    elevenlabsVoiceId: string;
    img: string;
    enabled: boolean;
    accent: string;
    ttsStability: number | null;
    ttsSimilarityBoost: number | null;
    ttsStyle: number | null;
    ttsSpeakerBoost: boolean | null;
  }>,
) {
  const { data } = await api.patch<Omit<AdminCharacter, "audioCount">>(
    `/admin/characters/${id}`,
    payload,
  );
  return data;
}

/**
 * @deprecated Genera Y publica de una, sin audición: usa `draftNarration` +
 * `publishNarration` para que el admin escuche la toma antes de aprobarla.
 */
export async function generateLetterAudio(id: number, characterId?: number) {
  const { data } = await api.post(
    `/admin/letter-items/${id}/generate-audio`,
    characterId != null ? { characterId } : {},
  );
  return data;
}

/**
 * @deprecated Genera Y publica de una, sin audición: usa `draftNarration` +
 * `publishNarration` para que el admin escuche la toma antes de aprobarla.
 */
export async function generateNumberAudio(id: number, characterId?: number) {
  const { data } = await api.post(
    `/admin/number-items/${id}/generate-audio`,
    characterId != null ? { characterId } : {},
  );
  return data;
}

// ── Reportes (spec 2026-10-01) ──────────────────────────────────
//
// Bandeja de reportes y respuestas aceptadas. Todo cuelga de AdminGuard (solo
// perfil 1) y el admin sale del token, nunca del cuerpo. Con la migración sin
// aplicar (tablas ausentes) las lecturas devuelven vacío y las ESCRITURAS
// `resolveReports` y `createAnswerAlternative` responden 503; borrar no falla,
// responde `{ deleted: false }`. Los 400 y demás de cada llamada están en su
// comentario.

/** Filtro de la bandeja: `closed` = lo que ya se resolvió (arreglado o descartado). */
export type AdminReportStatus = "pending" | "closed";

export type AdminReport = {
  id: number;
  userId: number;
  userName: string;
  isAdmin: boolean;
  surface: string;
  mode: string | null;
  targetType: string | null;
  targetId: string | null;
  reasons: string[];
  comment: string | null;
  answer: string | null;
  expected: string | null;
  wasWrong: boolean | null;
  snapshot: Record<string, unknown>;
  context: Record<string, unknown>;
  status: "pending" | "fixed" | "dismissed";
  note: string | null;
  gems: number;
  createdAt: string;
  resolvedAt: string | null;
};

export type AdminReportGroup = {
  type: string;
  id: string;
  prompt: string;
  surface: string;
  where: string | null;
  reasons: Record<string, number>;
  students: number;
  reports: number;
  lastAt: string;
};

/** El contenido reportado tal como está ahora, más el padre (nivel, pack, píldora…) que piden los modales. */
export type AdminReportContent = {
  content: Record<string, unknown>;
  parentId: number | null;
  parentLabel: string | null;
};

/**
 * Una respuesta que un alumno dio, que el sistema marcó mal y que él reportó,
 * agrupada con las iguales. `word` = una palabra de las opciones; `sentence` =
 * una oración en otro orden (Arma la oración, Constructor).
 */
export type AdminReportAnswer = {
  answer: string;
  kind: "word" | "sentence";
  count: number;
  reportIds: number[];
};

export type AdminAnswerAlternative = {
  id: number;
  targetType: string;
  targetId: string;
  kind: "word" | "sentence";
  value: string;
  createdAt: string;
};

export type AdminReportGroupDetail = {
  type: string;
  id: string;
  prompt: string;
  where: string | null;
  /** null si el ejercicio ya no existe o es contenido fijo del código (`false_friend`). */
  content: AdminReportContent | null;
  alternatives: AdminAnswerAlternative[];
  /** Solo de los reportes pendientes: lo que se puede «Aceptar». */
  answers: AdminReportAnswer[];
  /** Pendientes primero, hasta 200. */
  reports: AdminReport[];
};

export type AdminBugReport = AdminReport & { where: string | null };

/** Contadores de las pestañas: ejercicios con reportes de contenido pendientes y reportes de bug pendientes. */
export async function getReportSummary(): Promise<{ content: number; bugs: number }> {
  const { data } = await api.get("/admin/reports/summary");
  return data;
}

/**
 * Un grupo por ejercicio reportado, con más alumnos primero. `closed` solo mira
 * los últimos 100 reportes cerrados.
 */
export async function getReportGroups(status: AdminReportStatus): Promise<AdminReportGroup[]> {
  const { data } = await api.get("/admin/reports/groups", { params: { status } });
  return data;
}

/**
 * El detalle de un ejercicio: contenido de ahora, respuestas aceptadas,
 * respuestas por aceptar y reportes. 400 si `type` no es un tipo conocido o
 * `id` no es un entero.
 */
export async function getReportGroup(type: string, id: string): Promise<AdminReportGroupDetail> {
  const { data } = await api.get(`/admin/reports/groups/${type}/${id}`);
  return data;
}

/** Reportes con motivo `bug` o sin ejercicio. Uno mixto sale aquí y en su grupo. */
export async function getBugReports(status: AdminReportStatus): Promise<AdminBugReport[]> {
  const { data } = await api.get("/admin/reports/bugs", { params: { status } });
  return data;
}

/**
 * Cierra reportes como arreglados o descartados: de 1 a 200 ids y `note` de
 * hasta 500 caracteres (400 si no cumplen). `resolved` cuenta solo los que
 * seguían pendientes, así que cerrar dos veces no paga dos veces; `gems` es lo
 * que se pagó: 10 por reporte `fixed`, nada en `dismissed` ni a un reporte de
 * perfil 1. 503 si la migración no está aplicada.
 */
export async function resolveReports(
  ids: number[],
  outcome: "fixed" | "dismissed",
  note?: string,
): Promise<{ resolved: number; gems: number }> {
  const { data } = await api.post("/admin/reports/resolve", { ids, outcome, ...(note ? { note } : {}) });
  return data;
}

/**
 * Las respuestas aceptadas de una oración o un ítem de gramática. 400 si el id
 * no son solo dígitos; sin la migración devuelve `[]`.
 */
export async function getAnswerAlternatives(
  targetType: "sentence" | "grammar_item",
  targetId: string | number,
): Promise<AdminAnswerAlternative[]> {
  const { data } = await api.get("/admin/answer-alternatives", {
    params: { targetType, targetId: String(targetId) },
  });
  return data;
}

/**
 * Acepta una respuesta nueva. Idempotente: si ya existe (sin mirar mayúsculas)
 * devuelve la que había. El servidor reduce los espacios repetidos de `value` a
 * uno y lo recorta (1 a 300 caracteres); `sourceReportId` anota de qué reporte
 * salió.
 *  - 400: `grammar_item` con `kind: "sentence"` (la gramática solo acepta otras
 *    palabras); `sentence` con `kind: "sentence"` cuyo orden no usa las mismas
 *    fichas que la oración (distinto número de tokens); `value` vacío; o un
 *    `targetId` que no son solo dígitos.
 *  - 404: `sentence` con `kind: "sentence"` sobre una oración que ya no existe.
 *  - 409: otro admin la quitó justo mientras se guardaba; vuelve a intentarlo.
 *  - 503: la migración no está aplicada.
 */
export async function createAnswerAlternative(body: {
  targetType: "sentence" | "grammar_item";
  targetId: string;
  kind: "word" | "sentence";
  value: string;
  sourceReportId?: number;
}): Promise<AdminAnswerAlternative> {
  const { data } = await api.post("/admin/answer-alternatives", body);
  return data;
}

/**
 * Quita una respuesta aceptada. `deleted: false` si ya no existía (otro admin la
 * quitó) o si la migración no está aplicada; nunca responde 503.
 */
export async function deleteAnswerAlternative(id: number): Promise<{ deleted: boolean }> {
  const { data } = await api.delete(`/admin/answer-alternatives/${id}`);
  return data;
}
