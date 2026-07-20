/** Shared answer-feedback sounds (assets in /public/sounds/answers) */
export function playSound(type: "correct" | "wrong") {
  const src =
    type === "correct"
      ? "/sounds/answers/correct.wav"
      : "/sounds/answers/wrong.wav";
  new Audio(src).play().catch(() => {});
}
