import { readSoundEnabled } from "./sound-prefs";

/**
 * Sonidos de respuesta compartidos (assets en /public/sounds/answers).
 *
 * El gate vive aquí y no en las ocho pantallas que llaman a esta función
 * (práctica y siete juegos): así apagar los sonidos desde la hoja de ajustes
 * los apaga todos sin tocar ninguna. La NARRACIÓN no pasa por aquí y nunca se
 * silencia: es el contenido a aprender (components/ui/sound/sound.tsx y
 * hooks/use-lesson-audio.ts).
 */
export function playSound(type: "correct" | "wrong") {
  if (!readSoundEnabled()) return;
  const src =
    type === "correct"
      ? "/sounds/answers/correct.wav"
      : "/sounds/answers/wrong.wav";
  new Audio(src).play().catch(() => {});
}
