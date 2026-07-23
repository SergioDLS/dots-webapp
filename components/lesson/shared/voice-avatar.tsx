"use client";

import Image from "next/image";
import Doty from "@/components/ui/doty/doty";
import { resolveVoiceCharacter } from "@/lib/voice-characters";
import type { ItemCharacter } from "@/services/lessons.service";

interface VoiceAvatarProps {
  character?: ItemCharacter | null;
  voiceKey?: string | null;
  /** sm = avatar + nombre (rondas de escucha); xs = mini avatar (botones 🔊). */
  size?: "sm" | "xs";
}

export function VoiceAvatar({ character, voiceKey, size = "sm" }: VoiceAvatarProps) {
  const info = resolveVoiceCharacter(character, voiceKey);
  const art = character?.img;
  return (
    <div className="flex flex-col items-center gap-0.5">
      {art ? (
        <Image
          src={art}
          alt={info.name}
          width={64}
          height={64}
          className={`h-auto select-none ${size === "xs" ? "w-8" : "w-16"}`}
          draggable={false}
        />
      ) : (
        <Doty pose={info.pose} size={size === "xs" ? "micro" : "mini"} />
      )}
      {size === "sm" && (
        <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
          {info.name}
        </span>
      )}
    </div>
  );
}
