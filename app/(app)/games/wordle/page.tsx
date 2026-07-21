"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getWordleService,
  postWordleGuessService,
  type Mark,
  type WordleState,
} from "@/services/games.service";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_TRIES = 6;

// Keyboard rows (QWERTY)
const KB_ROW1 = ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"];
const KB_ROW2 = ["A", "S", "D", "F", "G", "H", "J", "K", "L"];
const KB_ROW3 = ["Z", "X", "C", "V", "B", "N", "M"];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Seconds until next UTC midnight from now. */
function secondsUntilMidnightUTC(): number {
  const now = new Date();
  const tomorrow = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0,
      0,
      0,
    ),
  );
  return Math.max(0, Math.floor((tomorrow.getTime() - now.getTime()) / 1000));
}

/** Format seconds as "Xh Ym" or "Ym" or "< 1 min". */
function formatCountdown(secs: number): string {
  if (secs <= 0) return "¡Nueva palabra ya disponible!";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m} min`;
  return "menos de 1 min";
}

/** CSS color token for a mark. */
function markColor(mark: Mark): string {
  if (mark === "hit") return "#22c55e"; // green
  if (mark === "present") return "#f59e0b"; // amber
  return "var(--muted)"; // gray
}

/** Best mark priority: hit > present > miss > undefined. */
function bestMark(a: Mark | undefined, b: Mark): Mark | undefined {
  if (a === "hit" || b === "hit") return "hit";
  if (a === "present" || b === "present") return "present";
  if (a === "miss" || b === "miss") return "miss";
  return undefined;
}

// ── Tile component ────────────────────────────────────────────────────────────

type TileProps = {
  letter: string;
  mark: Mark | null;
  revealed: boolean; // true = this row was submitted (flip animation)
  colIndex: number; // for staggered delay
};

function Tile({ letter, mark, revealed, colIndex }: TileProps) {
  const delay = `${colIndex * 120}ms`;

  const bg = revealed && mark ? markColor(mark) : "var(--surface)";
  const border =
    revealed && mark
      ? "transparent"
      : letter
        ? "var(--accent)"
        : "var(--border)";
  const color = revealed && mark ? "#fff" : "var(--foreground)";

  return (
    <div
      style={{
        width: "3rem",
        height: "3rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: `2px solid ${border}`,
        borderRadius: "0.5rem",
        background: bg,
        color,
        fontWeight: 800,
        fontSize: "1.1rem",
        fontFamily: "var(--font-display, sans-serif)",
        userSelect: "none",
        transform: revealed && mark ? "rotateX(0deg)" : undefined,
        animation: revealed && mark ? `wordle-flip 0.4s ease ${delay} both` : undefined,
        transition: "background 0.1s, border-color 0.1s",
      }}
    >
      {letter}
    </div>
  );
}

// ── Key component ─────────────────────────────────────────────────────────────

type KeyProps = {
  label: string;
  mark: Mark | undefined;
  onTap: (key: string) => void;
  wide?: boolean;
};

function Key({ label, mark, onTap, wide }: KeyProps) {
  const bg =
    mark === "hit"
      ? "#22c55e"
      : mark === "present"
        ? "#f59e0b"
        : mark === "miss"
          ? "var(--muted)"
          : "var(--surface)";
  const color =
    mark === "hit" || mark === "present" || mark === "miss"
      ? "#fff"
      : "var(--foreground)";

  return (
    <button
      onPointerUp={() => onTap(label)}
      style={{
        minWidth: wide ? "4rem" : "2.1rem",
        height: "3.2rem",
        padding: "0 0.25rem",
        border: "none",
        borderRadius: "0.4rem",
        background: bg,
        color,
        fontWeight: 700,
        fontSize: wide ? "0.75rem" : "0.9rem",
        cursor: "pointer",
        userSelect: "none",
        flexShrink: 0,
        transition: "background 0.2s",
      }}
    >
      {label === "⌫" ? "⌫" : label}
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WordlePage() {
  const router = useRouter();

  // Server state
  const [state, setState] = useState<WordleState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Current row typing
  const [currentWord, setCurrentWord] = useState("");

  // Shake animation on bad submit
  const [shaking, setShaking] = useState(false);
  const shakeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Submitting guard (prevents double-submit)
  const submittingRef = useRef(false);

  // Countdown to next word
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load state on mount ───────────────────────────────────────────────────

  const loadState = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    getWordleService()
      .then((s) => {
        setState(s);
        setCurrentWord("");
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  // Load on mount via async callback — avoids synchronous setState in effect body
  useEffect(() => {
    let active = true;
    getWordleService()
      .then((s) => {
        if (active) {
          setState(s);
          setCurrentWord("");
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setLoadError(true);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  // Start countdown when done — setCountdown called only inside async setInterval
  const isDone = state?.done ?? false;
  useEffect(() => {
    if (!isDone) return;
    const tick = () => setCountdown(secondsUntilMidnightUTC());
    const id = setInterval(tick, 60_000);
    countdownRef.current = id;
    // Initialise via the interval callback scheduled immediately
    const initId = setTimeout(tick, 0);
    return () => {
      clearInterval(id);
      clearTimeout(initId);
    };
  }, [isDone]);

  // Cleanup shake timer on unmount
  useEffect(() => {
    return () => {
      if (shakeRef.current) clearTimeout(shakeRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────

  const wordLength = state?.length ?? 5;
  const guesses = state?.guesses ?? [];
  const done = state?.done ?? false;

  // Key color map: best mark seen so far per letter
  const keyMarks: Record<string, Mark> = {};
  for (const g of guesses) {
    for (let i = 0; i < g.word.length; i++) {
      const letter = g.word[i];
      const m = g.marks[i];
      keyMarks[letter] = bestMark(keyMarks[letter], m) ?? m;
    }
  }

  // ── Key handler ───────────────────────────────────────────────────────────

  const handleKey = useCallback(
    (key: string) => {
      if (done) return;

      if (key === "⌫" || key === "BACKSPACE") {
        setCurrentWord((w) => w.slice(0, -1));
        return;
      }

      if (key === "ENTER" || key === "↵") {
        if (submittingRef.current) return;

        if (currentWord.length !== wordLength) {
          // Shake the current row
          setShaking(true);
          if (shakeRef.current) clearTimeout(shakeRef.current);
          shakeRef.current = setTimeout(() => setShaking(false), 400);
          return;
        }

        submittingRef.current = true;
        postWordleGuessService(currentWord)
          .then((s) => {
            setState(s);
            setCurrentWord("");
          })
          .catch(() => {
            // On error, shake to signal failure
            setShaking(true);
            if (shakeRef.current) clearTimeout(shakeRef.current);
            shakeRef.current = setTimeout(() => setShaking(false), 400);
          })
          .finally(() => {
            submittingRef.current = false;
          });
        return;
      }

      // Letter key
      if (/^[A-Z]$/.test(key) && currentWord.length < wordLength) {
        setCurrentWord((w) => w + key);
      }
    },
    [done, currentWord, wordLength],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          minHeight: "100svh",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: "0.75rem",
        }}
      >
        <div
          style={{
            width: "2rem",
            height: "2rem",
            border: "3px solid var(--border)",
            borderTopColor: "var(--accent)",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
          Cargando palabra del día…
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        style={{
          display: "flex",
          minHeight: "100svh",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: "1rem",
          padding: "1.5rem",
          textAlign: "center",
        }}
      >
        <p style={{ color: "var(--foreground)", fontWeight: 700 }}>
          No se pudo cargar la palabra de hoy.
        </p>
        <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>
          Revisa tu conexión e inténtalo de nuevo.
        </p>
        <button
          onPointerUp={loadState}
          style={{
            background: "var(--accent)",
            color: "var(--accent-foreground)",
            border: "none",
            borderRadius: "1rem",
            padding: "0.75rem 1.5rem",
            fontWeight: 700,
            fontSize: "0.9rem",
            cursor: "pointer",
          }}
        >
          Reintentar
        </button>
      </div>
    );
  }

  // Build the 6-row grid
  const rows: Array<{
    word: string;
    marks: (Mark | null)[];
    revealed: boolean;
  }> = [];

  for (let r = 0; r < MAX_TRIES; r++) {
    if (r < guesses.length) {
      // Submitted row
      rows.push({
        word: guesses[r].word,
        marks: guesses[r].marks,
        revealed: true,
      });
    } else if (r === guesses.length && !done) {
      // Current typing row — pad with spaces
      const padded = currentWord.padEnd(wordLength, " ");
      rows.push({
        word: padded,
        marks: new Array(wordLength).fill(null),
        revealed: false,
      });
    } else {
      // Empty row
      rows.push({
        word: " ".repeat(wordLength),
        marks: new Array(wordLength).fill(null),
        revealed: false,
      });
    }
  }

  const currentRowIndex = done ? -1 : guesses.length;

  return (
    <>
      {/* Flip animation keyframes injected once */}
      <style>{`
        @keyframes wordle-flip {
          0% { transform: rotateX(0deg); }
          50% { transform: rotateX(-90deg); background: var(--surface); }
          100% { transform: rotateX(0deg); }
        }
        @keyframes wordle-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          minHeight: "100svh",
          padding: "1rem 0.75rem 1.5rem",
          gap: "0.75rem",
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div
          style={{
            width: "100%",
            maxWidth: "24rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <button
            onPointerUp={() => router.push("/play")}
            style={{
              background: "none",
              border: "none",
              color: "var(--muted)",
              fontWeight: 700,
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            ← Salir
          </button>
          <div style={{ textAlign: "center" }}>
            <p
              style={{
                color: "var(--accent)",
                fontWeight: 900,
                fontSize: "1rem",
                margin: 0,
              }}
            >
              Palabra del Día
            </p>
            <p
              style={{
                color: "var(--muted)",
                fontSize: "0.7rem",
                margin: 0,
              }}
            >
              {wordLength} letras · {MAX_TRIES} intentos
            </p>
          </div>
          <div style={{ width: "3rem" }} />
        </div>

        {/* ── Hint ────────────────────────────────────────────────────────── */}
        {state?.hintEs && (
          <div
            style={{
              background: "color-mix(in srgb, var(--gold, #f59e0b) 15%, transparent)",
              border: "1.5px solid color-mix(in srgb, var(--gold, #f59e0b) 40%, transparent)",
              borderRadius: "0.75rem",
              padding: "0.5rem 1rem",
              maxWidth: "24rem",
              width: "100%",
              textAlign: "center",
              fontSize: "0.85rem",
              color: "var(--foreground)",
            }}
          >
            💡 Pista: <strong>{state.hintEs}</strong>
          </div>
        )}

        {/* ── Grid ────────────────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.4rem",
          }}
        >
          {rows.map((row, rIdx) => {
            const isCurrentRow = rIdx === currentRowIndex;
            return (
              <div
                key={rIdx}
                style={{
                  display: "flex",
                  gap: "0.4rem",
                  animation:
                    isCurrentRow && shaking
                      ? "wordle-shake 0.4s ease"
                      : undefined,
                }}
              >
                {Array.from({ length: wordLength }, (_, cIdx) => {
                  const letter = row.word[cIdx]?.trim() ?? "";
                  const mark = row.marks[cIdx] as Mark | null;
                  return (
                    <Tile
                      key={cIdx}
                      letter={letter}
                      mark={mark}
                      revealed={row.revealed}
                      colIndex={cIdx}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* ── Done card ───────────────────────────────────────────────────── */}
        {done && state && (
          <div
            style={{
              background: "var(--surface)",
              border: "1.5px solid var(--border)",
              borderRadius: "1rem",
              padding: "1rem 1.25rem",
              maxWidth: "24rem",
              width: "100%",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            {state.won ? (
              <>
                <p
                  style={{
                    fontSize: "1.5rem",
                    margin: 0,
                  }}
                >
                  🎉
                </p>
                <p
                  style={{
                    fontWeight: 900,
                    fontSize: "1rem",
                    color: "#22c55e",
                    margin: 0,
                  }}
                >
                  ¡Excelente! La palabra era{" "}
                  <strong>{state.answer}</strong>
                </p>
                <p style={{ color: "var(--muted)", fontSize: "0.8rem", margin: 0 }}>
                  Lo lograste en {guesses.length}{" "}
                  {guesses.length === 1 ? "intento" : "intentos"} •{" "}
                  {(7 - guesses.length) * 50} pts
                </p>
              </>
            ) : (
              <>
                <p style={{ fontSize: "1.5rem", margin: 0 }}>😔</p>
                <p
                  style={{
                    fontWeight: 900,
                    fontSize: "1rem",
                    color: "var(--foreground)",
                    margin: 0,
                  }}
                >
                  La palabra era <strong>{state.answer}</strong>
                </p>
                <p style={{ color: "var(--muted)", fontSize: "0.8rem", margin: 0 }}>
                  ¡Mañana lo intentas de nuevo!
                </p>
              </>
            )}

            <div
              style={{
                borderTop: "1px solid var(--border)",
                paddingTop: "0.5rem",
                marginTop: "0.25rem",
              }}
            >
              <p
                style={{
                  color: "var(--muted)",
                  fontSize: "0.75rem",
                  margin: "0 0 0.5rem",
                }}
              >
                ⏰ Nueva palabra en <strong>{formatCountdown(countdown)}</strong>
              </p>
              <button
                onPointerUp={() => router.push("/play")}
                style={{
                  background: "var(--accent)",
                  color: "var(--accent-foreground)",
                  border: "none",
                  borderRadius: "0.75rem",
                  padding: "0.6rem 1.25rem",
                  fontWeight: 700,
                  fontSize: "0.875rem",
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                Volver a Zona de Juego
              </button>
            </div>
          </div>
        )}

        {/* ── On-screen keyboard ──────────────────────────────────────────── */}
        {!done && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.35rem",
              marginTop: "auto",
              paddingTop: "0.5rem",
              width: "100%",
              maxWidth: "24rem",
            }}
          >
            {/* Row 1: Q-P */}
            <div
              style={{ display: "flex", gap: "0.25rem", justifyContent: "center" }}
            >
              {KB_ROW1.map((k) => (
                <Key key={k} label={k} mark={keyMarks[k]} onTap={handleKey} />
              ))}
            </div>
            {/* Row 2: A-L */}
            <div
              style={{ display: "flex", gap: "0.25rem", justifyContent: "center" }}
            >
              {KB_ROW2.map((k) => (
                <Key key={k} label={k} mark={keyMarks[k]} onTap={handleKey} />
              ))}
            </div>
            {/* Row 3: Enter + Z-M + ⌫ */}
            <div
              style={{ display: "flex", gap: "0.25rem", justifyContent: "center" }}
            >
              <Key label="↵" mark={undefined} onTap={() => handleKey("ENTER")} wide />
              {KB_ROW3.map((k) => (
                <Key key={k} label={k} mark={keyMarks[k]} onTap={handleKey} />
              ))}
              <Key label="⌫" mark={undefined} onTap={() => handleKey("⌫")} wide />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
