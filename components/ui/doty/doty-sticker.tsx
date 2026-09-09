"use client";

import Doty, { type DotyPose } from "./doty";

export type StickerKind =
  | "good-job" | "amazing" | "keep-going" | "you-can-do-it" | "lets-practice"
  | "oops" | "almost" | "nice" | "excellent" | "see-you";

/** Copy en español; el sprite no lleva texto quemado (spec §3.8). */
const STICKER_TEXT: Record<StickerKind, string> = {
  "good-job": "¡Buen trabajo!",
  amazing: "¡Increíble!",
  "keep-going": "¡Sigue así!",
  "you-can-do-it": "¡Tú puedes!",
  "lets-practice": "¡A practicar!",
  oops: "¡Ups!",
  almost: "¡Casi!",
  nice: "¡Bien!",
  excellent: "¡Excelente!",
  "see-you": "¡Hasta pronto!",
};

interface DotyStickerProps {
  kind: StickerKind;
  size?: "mini" | "tiny";
}

export default function DotySticker({ kind, size = "mini" }: DotyStickerProps) {
  const pose = `sticker-${kind}` as DotyPose;
  return <Doty pose={pose} size={size} shadow={false} say={STICKER_TEXT[kind]} />;
}
