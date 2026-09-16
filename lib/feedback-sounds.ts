import { readSoundEnabled } from "./sound-prefs";

/**
 * Sonidos de respuesta compartidos (assets en /public/sounds/answers).
 *
 * El gate vive aquí y no en los quince importadores de esta función (diez
 * juegos, la práctica, tres componentes de lección y un hook): así apagar
 * los sonidos desde la hoja de ajustes los apaga todos sin tocar ninguno. La
 * NARRACIÓN no pasa por aquí y nunca se silencia: es el contenido a aprender
 * (components/ui/sound/sound.tsx y hooks/use-lesson-audio.ts).
 */
export function playSound(type: "correct" | "wrong") {
  if (!readSoundEnabled()) return;
  const src =
    type === "correct"
      ? "/sounds/answers/correct.wav"
      : "/sounds/answers/wrong.wav";
  new Audio(src).play().catch(() => {});
}
