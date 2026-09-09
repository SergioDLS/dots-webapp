import type { DotyPose } from "@/components/ui/doty/doty";
import type { ItemCharacter } from "@/services/lessons.service";

export type VoiceCharacterInfo = { key: string; name: string; pose: DotyPose };

/** Pose de respaldo por personaje mientras `characters.img` está vacío (lo llena
 *  dots-backend/scripts/set-doty-art.js). VoiceAvatar prefiere `img` cuando existe,
 *  así que en cuanto llegue el arte estas poses dejan de usarse: su único trabajo
 *  hoy es que los cuatro narradores se distingan entre sí, y por eso cada uno cae
 *  a un sprite legacy distinto (13 / 14 / 07 / 11) en vez de compartir `hablando`. */
const BY_KEY: Record<string, VoiceCharacterInfo> = {
  doty:             { key: "doty",           name: "Doty",            pose: "hablando" },
  "doty-fem":       { key: "doty-fem",       name: "Doty Fem",        pose: "saludando" },
  "doty-sailor":    { key: "doty-sailor",    name: "Doty marinero",   pose: "pensando" },
  "doty-scientist": { key: "doty-scientist", name: "Doty científica", pose: "riendo" },
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
