import type { DotyPose } from "@/components/ui/doty/doty";
import type { ItemCharacter } from "@/services/lessons.service";

export type VoiceCharacterInfo = {
  key: string;
  name: string;
  pose: DotyPose;
  /** Avatar de la tienda con el mismo personaje (public/images/avatars/). */
  avatar?: string;
};

/** `avatar` es el arte de la práctica, que solo recibe `voice_key` y no la
 *  `characters.img` que traen las lecciones. Doty no tiene avatar propio:
 *  la voz por defecto se queda con su pose. La pose de los otros tres solo
 *  sale si alguna vez falta el PNG del avatar. */
const BY_KEY: Record<string, VoiceCharacterInfo> = {
  doty:             { key: "doty",           name: "Doty",            pose: "hablando" },
  "doty-fem":       { key: "doty-fem",       name: "Doty Fem",        pose: "saludando", avatar: "/images/avatars/fem.png" },
  "doty-sailor":    { key: "doty-sailor",    name: "Doty marinero",   pose: "pensando",  avatar: "/images/avatars/marinero.png" },
  "doty-scientist": { key: "doty-scientist", name: "Doty científica", pose: "riendo",    avatar: "/images/avatars/cientifica.png" },
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
      avatar: base?.avatar,
    };
  }
  if (voiceKey && BY_KEY[voiceKey]) return BY_KEY[voiceKey];
  return DEFAULT_CHARACTER;
}
