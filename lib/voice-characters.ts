import type { ItemCharacter } from "@/services/lessons.service";

export type VoiceCharacterInfo = { key: string; name: string; pose: string };

/** Placeholder visual por personaje (poses PNG existentes de public/images/Doty)
 *  hasta que llegue el arte de Midjourney (characters.img). */
const BY_KEY: Record<string, VoiceCharacterInfo> = {
  doty: { key: "doty", name: "Doty", pose: "02" },
  "doty-fem": { key: "doty-fem", name: "Doty Fem", pose: "17" },
  "doty-captain": { key: "doty-captain", name: "Doty capitán", pose: "07" },
  "doty-scientist": { key: "doty-scientist", name: "Doty científica", pose: "11" },
};

const DEFAULT_CHARACTER = BY_KEY.doty;

/** Resuelve la identidad visual: payload de lección si viene; voiceKey solo
 *  (practice) mapea por key; sin dato → Doty (la voz legacy es la default). */
export function resolveVoiceCharacter(
  character?: ItemCharacter | null,
  voiceKey?: string | null,
): VoiceCharacterInfo {
  if (character) {
    const base = BY_KEY[character.key];
    return {
      key: character.key,
      name: character.name,
      pose: base?.pose ?? DEFAULT_CHARACTER.pose,
    };
  }
  if (voiceKey && BY_KEY[voiceKey]) return BY_KEY[voiceKey];
  return DEFAULT_CHARACTER;
}
