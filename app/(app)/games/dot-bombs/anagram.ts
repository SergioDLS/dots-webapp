// app/(app)/games/dot-bombs/anagram.ts
// Lógica pura de la bandeja de anagrama. Sin React ni DOM: portable a RN.

export type Rng = () => number; // [0,1) — inyectable (seed/tests)

export type TrayChip = {
  id: number; // estable dentro de la bandeja (índice de creación)
  char: string; // minúscula
  used: boolean; // ya colocada en la palabra
  decoy: boolean; // señuelo: no pertenece a la palabra
};

export type TrayState = {
  word: string; // objetivo, en minúsculas
  /** Huecos de la palabra: char ya colocado o "" pendiente.
   *  Los caracteres fuera de [a-z] (espacios, guiones) vienen PRE-colocados. */
  display: string[];
  nextSlot: number; // índice del siguiente hueco pendiente; -1 = completa
  chips: TrayChip[];
};

export type TapResult = "progress" | "wrong" | "complete" | "noop";

const ALPHABET = "abcdefghijklmnopqrstuvwxyz";

function isLetter(ch: string): boolean {
  return ch >= "a" && ch <= "z";
}

/** Fisher-Yates con rng inyectado (muta la copia local, no el argumento). */
function shuffleWith<T>(arr: T[], rng: Rng): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Primer hueco pendiente desde `from` (saltando pre-colocados). -1 si no queda. */
function nextPendingSlot(display: string[], word: string, from: number): number {
  for (let i = from; i < word.length; i++) {
    if (display[i] === "") return i;
  }
  return -1;
}

export function buildTray(word: string, decoys: number, rng: Rng): TrayState {
  const target = word.toLowerCase();
  const display = Array.from(target, (ch) => (isLetter(ch) ? "" : ch));

  const letters = Array.from(target).filter(isLetter);
  const wordSet = new Set(letters);
  const decoyPool = Array.from(ALPHABET).filter((ch) => !wordSet.has(ch));
  const chosen = shuffleWith(decoyPool, rng).slice(0, Math.max(0, decoys));

  const chips: TrayChip[] = shuffleWith(
    [
      ...letters.map((char) => ({ char, decoy: false })),
      ...chosen.map((char) => ({ char, decoy: true })),
    ],
    rng,
  ).map((c, id) => ({ id, char: c.char, used: false, decoy: c.decoy }));

  return {
    word: target,
    display,
    nextSlot: nextPendingSlot(display, target, 0),
    chips,
  };
}

export function tapChip(
  state: TrayState,
  chipId: number,
): { state: TrayState; result: TapResult } {
  const chip = state.chips.find((c) => c.id === chipId);
  // Ficha inexistente/usada o palabra ya completa: no-op (la UI deshabilita,
  // esto es el guard de fondo)
  if (!chip || chip.used || state.nextSlot === -1) {
    return { state, result: "noop" };
  }
  if (chip.char !== state.word[state.nextSlot]) {
    return { state, result: "wrong" };
  }

  const display = [...state.display];
  display[state.nextSlot] = chip.char;
  const next: TrayState = {
    ...state,
    display,
    nextSlot: nextPendingSlot(display, state.word, state.nextSlot + 1),
    chips: state.chips.map((c) => (c.id === chipId ? { ...c, used: true } : c)),
  };
  return { state: next, result: next.nextSlot === -1 ? "complete" : "progress" };
}
