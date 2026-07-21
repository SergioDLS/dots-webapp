"use client";

import React, {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GameIntro from "@/components/games/shared/game-intro";
import GameResult from "@/components/games/shared/game-result";
import Spinner from "@/components/ui/Spinner/Spinner";
import WordImg from "@/components/ui/word-img/word-img";
import { getMemoryPairsService, type MemoryPair } from "@/services/games.service";
import { playSound } from "@/lib/feedback-sounds";

// ── Constants ─────────────────────────────────────────────────────────────────

const FLIP_BACK_MS = 800;
const MEMORY_PAIRS = 8;

// Score formula: max(50, 1000 − seconds×8 − moves×10)
function calcScore(seconds: number, moves: number): number {
  return Math.max(50, 1000 - seconds * 8 - moves * 10);
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ── Card model ────────────────────────────────────────────────────────────────

type CardKind = "word" | "image";

interface Card {
  /** Unique key per slot (pairId + kind). */
  key: string;
  /** Pair id — word and image cards sharing the same pairId are a match. */
  pairId: number;
  kind: CardKind;
  /** Text (word cards) or Cloudinary URL (image cards). */
  content: string;
}

function buildCards(pairs: MemoryPair[]): Card[] {
  const cards: Card[] = [];
  for (const p of pairs) {
    cards.push({ key: `w-${p.id}`, pairId: p.id, kind: "word", content: p.word });
    cards.push({ key: `i-${p.id}`, pairId: p.id, kind: "image", content: p.img });
  }
  // Client-side shuffle (Fisher-Yates)
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

// ── Seed reader (inside Suspense boundary) ────────────────────────────────────

function MemoryGame() {
  const searchParams = useSearchParams();
  const seedParam = searchParams.get("seed");
  const seed =
    seedParam !== null && seedParam !== ""
      ? parseInt(seedParam, 10)
      : undefined;
  return <MemoryInner seed={seed} />;
}

// ── Main game component ───────────────────────────────────────────────────────

type Phase = "intro" | "playing" | "result";

function MemoryInner({ seed }: { seed?: number }) {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("intro");
  const [pairs, setPairs] = useState<MemoryPair[]>([]);
  const [loading, setLoading] = useState(true);

  // Game state
  const [cards, setCards] = useState<Card[]>([]);
  const [flipped, setFlipped] = useState<Set<string>>(new Set());
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [seconds, setSeconds] = useState(0);
  const [moves, setMoves] = useState(0);

  // Refs
  const openKeysRef = useRef<string[]>([]); // at most 2 currently open (not yet matched)
  const resolvingRef = useRef(false);        // true while the 800ms flip-back is pending
  const flipBackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);

  // Load pairs once
  useEffect(() => {
    let active = true;
    getMemoryPairsService(seed)
      .then((data) => {
        if (active) setPairs(data);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [seed]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (flipBackTimerRef.current) clearTimeout(flipBackTimerRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  // Ascending timer — runs only while playing
  const startTimer = useCallback(() => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    startedAtRef.current = Date.now();
    setSeconds(0);
    timerIntervalRef.current = setInterval(() => {
      setSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 500); // poll at 500ms for smooth display
  }, []);

  const stopTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    // Capture final elapsed time
    setSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
  }, []);

  const startGame = useCallback(() => {
    // Clean up any pending timers from a previous run
    if (flipBackTimerRef.current) clearTimeout(flipBackTimerRef.current);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    openKeysRef.current = [];
    resolvingRef.current = false;
    setCards(buildCards(pairs));
    setFlipped(new Set());
    setMatched(new Set());
    setMoves(0);
    setPhase("playing");
    startTimer();
  }, [pairs, startTimer]);

  const handleCardTap = useCallback(
    (card: Card) => {
      if (resolvingRef.current) return;          // lock during flip-back delay
      if (matched.has(card.key)) return;         // already matched
      if (flipped.has(card.key)) return;         // already face-up (same card tapped twice)
      if (openKeysRef.current.includes(card.key)) return; // edge-case safety

      // Flip the card face-up
      const newFlipped = new Set(flipped);
      newFlipped.add(card.key);
      setFlipped(newFlipped);

      const open = [...openKeysRef.current, card.key];
      openKeysRef.current = open;

      if (open.length < 2) return; // wait for second tap

      // --- Second card tapped: evaluate the pair ---
      const [keyA, keyB] = open;
      const cardA = cards.find((c) => c.key === keyA)!;
      const cardB = cards.find((c) => c.key === keyB)!;
      const isMatch = cardA.pairId === cardB.pairId;

      setMoves((m) => m + 1);

      if (isMatch) {
        playSound("correct");
        const newMatched = new Set(matched);
        newMatched.add(keyA);
        newMatched.add(keyB);
        openKeysRef.current = [];
        setMatched(newMatched);

        // All pairs found → game over
        if (newMatched.size === MEMORY_PAIRS * 2) {
          stopTimer();
          // Use final elapsed seconds for score — schedule slightly so timer state settles
          setTimeout(() => setPhase("result"), 200);
        }
      } else {
        playSound("wrong");
        resolvingRef.current = true;
        flipBackTimerRef.current = setTimeout(() => {
          resolvingRef.current = false;
          openKeysRef.current = [];
          // Flip both back (remove from flipped set — matched ones stay open via matched set)
          setFlipped((prev) => {
            const next = new Set(prev);
            next.delete(keyA);
            next.delete(keyB);
            return next;
          });
        }, FLIP_BACK_MS);
      }
    },
    [cards, flipped, matched, stopTimer],
  );

  // ── Derived values ────────────────────────────────────────────────────────

  const isCardFaceUp = (card: Card) =>
    matched.has(card.key) || flipped.has(card.key);

  const isCardMatched = (card: Card) => matched.has(card.key);

  // Score is computed from the FINAL seconds/moves at result phase
  const finalScore = calcScore(seconds, moves);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner title="Cargando cartas…" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center overflow-hidden px-4 py-6">
      {/* Background glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--accent)" }}
      />

      {/* ── Intro ──────────────────────────────────────────────────────── */}
      {phase === "intro" && (
        <>
          <div className="z-10 flex w-full max-w-sm justify-start">
            <button
              onClick={() => router.push("/play")}
              className="text-sm font-bold transition-colors"
              style={{ color: "var(--muted)" }}
            >
              ← Salir
            </button>
          </div>
          <GameIntro
            emoji="🧠"
            title="Memoria Relámpago"
            howTo={[
              "Se esconden 16 cartas: 8 palabras y 8 imágenes.",
              "Toca una carta para voltearla.",
              "Toca una segunda carta: si forman pareja (palabra + su imagen) quedan abiertas.",
              "Si no coinciden, se voltean de nuevo después de 800 ms.",
              "¡Encuentra los 8 pares lo antes posible para maximizar tu puntuación!",
            ]}
            record={null}
            throne={null}
            onStart={startGame}
          />
        </>
      )}

      {/* ── Playing ────────────────────────────────────────────────────── */}
      {phase === "playing" && (
        <>
          {/* Top bar */}
          <div
            className="dots-card z-10 flex w-full max-w-sm items-center justify-between gap-3 px-4 py-3"
            style={{ marginBottom: "1rem" }}
          >
            <button
              onClick={() => {
                stopTimer();
                setPhase("result");
              }}
              className="text-sm font-bold transition-colors"
              style={{ color: "var(--muted)" }}
            >
              ← Salir
            </button>

            {/* Timer */}
            <div className="flex flex-col items-center">
              <span
                className="text-xs font-black uppercase tracking-widest"
                style={{ color: "var(--muted)" }}
              >
                Tiempo
              </span>
              <span
                className="font-display text-xl font-extrabold tabular-nums"
                style={{ color: "var(--accent)" }}
              >
                {formatTime(seconds)}
              </span>
            </div>

            {/* Moves */}
            <div className="flex flex-col items-end">
              <span
                className="text-xs font-black uppercase tracking-widest"
                style={{ color: "var(--muted)" }}
              >
                Movimientos
              </span>
              <span
                className="font-display text-xl font-extrabold tabular-nums"
                style={{ color: "var(--foreground)" }}
              >
                {moves}
              </span>
            </div>
          </div>

          {/* Progress indicator */}
          <div className="z-10 w-full max-w-sm mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold" style={{ color: "var(--muted)" }}>
                Pares encontrados
              </span>
              <span className="text-xs font-black" style={{ color: "var(--success)" }}>
                {matched.size / 2} / {MEMORY_PAIRS}
              </span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full"
              style={{ background: "var(--border)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${(matched.size / (MEMORY_PAIRS * 2)) * 100}%`,
                  background: "var(--success)",
                }}
              />
            </div>
          </div>

          {/* 4×4 grid */}
          <div className="z-10 grid w-full max-w-sm gap-2" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
            {cards.map((card) => {
              const faceUp = isCardFaceUp(card);
              const isMatched = isCardMatched(card);

              return (
                <button
                  key={card.key}
                  onClick={() => handleCardTap(card)}
                  disabled={faceUp && !isMatched ? false : isMatched}
                  className="relative select-none"
                  style={{
                    aspectRatio: "1 / 1",
                    perspective: "600px",
                    // Matched cards are inert but still visible — don't hide them
                    cursor: isMatched ? "default" : "pointer",
                  }}
                  aria-label={faceUp ? (card.kind === "word" ? card.content : "imagen") : "carta boca abajo"}
                >
                  {/* Card wrapper — rotates on flip */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      transformStyle: "preserve-3d",
                      transform: faceUp ? "rotateY(180deg)" : "rotateY(0deg)",
                      transition: "transform 0.35s ease",
                    }}
                  >
                    {/* ── Back face ── */}
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        backfaceVisibility: "hidden",
                        WebkitBackfaceVisibility: "hidden",
                        borderRadius: "0.75rem",
                        background: "var(--surface)",
                        border: "2px solid var(--border)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "1.25rem",
                      }}
                    >
                      🔵
                    </div>

                    {/* ── Front face ── */}
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        backfaceVisibility: "hidden",
                        WebkitBackfaceVisibility: "hidden",
                        transform: "rotateY(180deg)",
                        borderRadius: "0.75rem",
                        background: isMatched
                          ? "color-mix(in srgb, var(--success) 18%, var(--surface))"
                          : "var(--surface)",
                        border: isMatched
                          ? "2px solid var(--success)"
                          : "2px solid var(--accent)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "4px",
                        overflow: "hidden",
                      }}
                    >
                      {card.kind === "word" ? (
                        <span
                          className="font-display font-extrabold text-center leading-tight"
                          style={{
                            color: "var(--foreground)",
                            fontSize: "clamp(0.55rem, 2.8vw, 0.8rem)",
                            wordBreak: "break-word",
                            hyphens: "auto",
                          }}
                        >
                          {card.content}
                        </span>
                      ) : (
                        <WordImg
                          src={card.content}
                          size="w-full h-full"
                          customClass="rounded"
                        />
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* ── Result ─────────────────────────────────────────────────────── */}
      {phase === "result" && (
        <GameResult
          gameKey="memory"
          score={finalScore}
          onReplay={startGame}
          onExit={() => router.push("/play")}
          extra={
            <p
              className="text-sm font-bold text-center"
              style={{ color: "var(--muted)" }}
            >
              {formatTime(seconds)} · {moves} movimiento{moves !== 1 ? "s" : ""}
            </p>
          }
        />
      )}
    </div>
  );
}

// ── Page export with Suspense gate ────────────────────────────────────────────

export default function MemoryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Spinner title="Cargando…" />
        </div>
      }
    >
      <MemoryGame />
    </Suspense>
  );
}
