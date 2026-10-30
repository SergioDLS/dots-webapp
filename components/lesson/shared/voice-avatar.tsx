"use client";

import Image from "next/image";
import Doty from "@/components/ui/doty/doty";
import { resolveVoiceCharacter } from "@/lib/voice-characters";
import type { ItemCharacter } from "@/services/lessons.service";

interface VoiceAvatarProps {
  character?: ItemCharacter | null;
  voiceKey?: string | null;
}

/** Quién narra la consigna de una ronda de escucha. Va junto al audio que se
 *  escucha, nunca dentro de un botón de opción: ahí cada altavoz es una
 *  respuesta, y marcarlo con el narrador no ayuda a elegir. Sin nombre
 *  debajo: el arte ya dice quién narra, y el nombre queda en el `alt`. */
export function VoiceAvatar({ character, voiceKey }: VoiceAvatarProps) {
  const info = resolveVoiceCharacter(character, voiceKey);
  const art = character?.img ?? info.avatar;
  return art ? (
    <Image
      src={art}
      alt={info.name}
      width={64}
      height={64}
      className="h-auto w-16 select-none"
      draggable={false}
    />
  ) : (
    <Doty pose={info.pose} size="mini" />
  );
}
