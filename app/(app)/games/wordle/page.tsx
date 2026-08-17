"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import DailyKeyboard, { KEY_ENTER, KEY_BACKSPACE } from "@/components/games/shared/daily-keyboard";
import Spinner from "@/components/ui/Spinner/Spinner";
import { secondsUntilMidnightUTC, formatCountdown } from "@/lib/daily-games";
import {
  getWordleService,
  postWordleGuessService,
  type Mark,
  type WordleState,
} from "@/services/games.service";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Fallback si el estado aún no llegó; el valor real manda desde el servidor. */
const DEFAULT_MAX_TRIES = 6;

// Keyboard rows (QWERTY)

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Seconds until next UTC midnight from now. */
/** Format seconds as "Xh Ym" or "Ym" or "< 1 min". */
/** CSS color token for a mark. */
function markColor(mark: Mark): string {
  if (mark === "hit") return "#22c55e"; // green
  if (mark === "present") return "#f59e0b"; // amber
  return "var(--muted)"; // gray
}

/** Best mark priority: hit > present > miss > undefined. */
/** Prioridad hit > present > miss. `b` siempre es una marca, así que el
 *  resultado nunca es undefined (antes el tipo lo permitía y obligaba a un
 *  `?? m` que nunca se ejecutaba). */
function bestMark(a: Mark | undefined, b: Mark): Mark {
  if (a === "hit" || b === "hit") return "hit";
  if (a === "present" || b === "present") return "present";
  return "miss";
}

// ── Tile component ────────────────────────────────────────────────────────────

type TileProps = {
  letter: string;
  mark: Mark | null;
  revealed: boolean; // true = this row was submitted (renders colored)
  animate: boolean; // true = row submitted THIS session (flip animation)
  colIndex: number; // for staggered delay
};

function Tile({ letter, mark, revealed, animate, colIndex }: TileProps) {
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
        // La unidad la fija la rejilla según la longitud de la palabra del día
        width: "var(--wd-tile)",
        // Cuadrada sin alto fijo: un alto en % se resolvería contra la altura
        // del padre, no contra la anchura, así que aquí manda `aspect-ratio`
        // (que Yoga también entiende, o sea que sigue siendo portable a RN)
        aspectRatio: "1",
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
        // La letra recién escrita da un golpe seco; la fila enviada voltea.
        // El remonte por `key` (en la fila) es lo que relanza el pop.
        animation:
          revealed && mark && animate
            ? `wordle-flip 0.4s ease ${delay} both`
            : !revealed && letter
              ? "dots-score-pop 0.18s var(--ease-out-strong)"
              : undefined,
        transition: "background 0.1s, border-color 0.1s",
      }}
    >
      {letter}
    </div>
  );
}

// ── Key component ─────────────────────────────────────────────────────────────

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WordlePage() {
  const router = useRouter();

  // Server state
  const [state, setState] = useState<WordleState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Current row typing
  const [currentWord, setCurrentWord] = useState("");

  // Rows already on the board when it loaded — they render colored but do
  // NOT replay the flip animation (only rows submitted this session flip).
  const [preloadedRows, setPreloadedRows] = useState(0);

  // Shake animation on bad submit
  const [shaking, setShaking] = useState(false);
  const shakeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // El intento no llegó al servidor. Sin esto, quedarse sin red y escribir una
  // palabra a medias producían exactamente el mismo temblor de 400 ms: dos
  // causas distintas con feedback idéntico.
  const [submitError, setSubmitError] = useState(false);

  // Submitting guard (prevents double-submit). El ref decide, el estado se lo
  // cuenta al teclado: un ref no re-renderiza y por eso el ↵ no se enteraba.
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);

  // Countdown to next word
  // Arranca con el valor real: con 0 el primer frame decía "ya disponible"
  const [countdown, setCountdown] = useState(() => secondsUntilMidnightUTC());

  // ── Load state on mount ───────────────────────────────────────────────────

  // Carga inicial y Reintentar comparten este efecto; el botón solo bumpea
  // fetchAttempt (regla 5) — antes el mismo fetch estaba escrito dos veces
  const [fetchAttempt, setFetchAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    getWordleService()
      .then((s) => {
        if (active) {
          setState(s);
          setPreloadedRows(s.guesses.length);
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
  }, [fetchAttempt]);

  const retryLoad = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    setFetchAttempt((n) => n + 1);
  }, []);

  // Start countdown when done — setCountdown called only inside async setInterval
  const isDone = state?.done ?? false;
  useEffect(() => {
    if (!isDone) return;
    const tick = () => setCountdown(secondsUntilMidnightUTC());
    const id = setInterval(tick, 60_000);
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
    };
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────

  const wordLength = state?.length ?? 5;
  // El servidor manda: antes un MAX_TRIES = 6 hardcodeado dibujaba la
  // cuadrícula, así que un cambio de backend la habría desincronizado
  const maxTries = state?.maxTries ?? DEFAULT_MAX_TRIES;
  const guesses = state?.guesses ?? [];
  const done = state?.done ?? false;

  // Key color map: best mark seen so far per letter
  const keyMarks: Record<string, Mark> = {};
  for (const g of guesses) {
    for (let i = 0; i < g.word.length; i++) {
      const letter = g.word[i];
      const m = g.marks[i];
      keyMarks[letter] = bestMark(keyMarks[letter], m);
    }
  }

  // ── Key handler ───────────────────────────────────────────────────────────

  const handleKey = useCallback(
    (key: string) => {
      if (done) return;

      if (key === KEY_BACKSPACE || key === "BACKSPACE") {
        setSubmitError(false);
        setCurrentWord((w) => w.slice(0, -1));
        return;
      }

      if (key === KEY_ENTER || key === "↵") {
        if (submittingRef.current) return;

        if (currentWord.length !== wordLength) {
          // Shake the current row
          setShaking(true);
          setSubmitError(false); // palabra incompleta: no es un fallo de red
          if (shakeRef.current) clearTimeout(shakeRef.current);
          shakeRef.current = setTimeout(() => setShaking(false), 400);
          return;
        }

        submittingRef.current = true;
        setSubmitting(true);
        setSubmitError(false);
        postWordleGuessService(currentWord)
          .then((s) => {
            setState(s);
            setCurrentWord("");
          })
          .catch(() => {
            // On error, shake to signal failure
            setShaking(true);
            setSubmitError(true);
            if (shakeRef.current) clearTimeout(shakeRef.current);
            shakeRef.current = setTimeout(() => setShaking(false), 400);
          })
          .finally(() => {
            submittingRef.current = false;
            setSubmitting(false);
          });
        return;
      }

      // Letter key
      if (/^[A-Z]$/.test(key) && currentWord.length < wordLength) {
        setSubmitError(false);
        setCurrentWord((w) => w + key);
      }
    },
    [done, currentWord, wordLength],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    // Spinner compartido. El de aquí era una rueda dibujada a mano que pedía
    // `@keyframes spin`, y ese keyframe vive en el <style> del render normal
    // — que con `loading` en true nunca llega a montarse. O sea: la rueda no
    // giraba, era un anillo quieto.
    return (
      <div className="flex min-h-[100svh] items-center justify-center">
        <Spinner title="Cargando palabra del día…" />
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
          onPointerUp={retryLoad}
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

  for (let r = 0; r < maxTries; r++) {
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
        /* transform-only (RN/Reanimated-portable) */
        @keyframes wordle-flip {
          0% { transform: rotateX(0deg); }
          50% { transform: rotateX(-90deg); }
          100% { transform: rotateX(0deg); }
        }
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
              {wordLength} letras · {maxTries} intentos
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
        {/*
          La rejilla se adapta al ancho. Antes las casillas medían 3 rem fijos,
          así que con una palabra de 6 letras (el backend sirve de 4 a 6) el
          tablero pedía 320 px: en un móvil de 320 se comía el padding entero y
          quedaba pegado a los dos bordes, y por debajo de eso desbordaba.
          El `maxWidth` mantiene el tamaño de siempre en cuanto hay sitio.
        */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.4rem",
            width: "100%",
            maxWidth: `calc(${wordLength} * 3rem + ${wordLength - 1} * 0.4rem)`,
            ["--wd-tile" as string]: `calc((100% - ${wordLength - 1} * 0.4rem) / ${wordLength})`,
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
                      ? "dots-shake-x 0.4s var(--ease-out-strong)"
                      : undefined,
                }}
              >
                {Array.from({ length: wordLength }, (_, cIdx) => {
                  const letter = row.word[cIdx]?.trim() ?? "";
                  const mark = row.marks[cIdx] as Mark | null;
                  return (
                    <Tile
                      // La letra entra en la `key` para que escribirla remonte
                      // la casilla y su pop se reproduzca; `revealed` también,
                      // porque el volteo del envío necesita el mismo remonte
                      key={`${cIdx}:${letter}:${row.revealed}`}
                      letter={letter}
                      mark={mark}
                      revealed={row.revealed}
                      animate={row.revealed && rIdx >= preloadedRows}
                      colIndex={cIdx}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Aviso si el intento no llegó al servidor (distinto del temblor de
            "palabra incompleta", que no lleva texto) */}
        {!done && submitError && (
          <p
            role="status"
            style={{
              color: "var(--danger)",
              fontSize: "0.8rem",
              fontWeight: 700,
              margin: 0,
              textAlign: "center",
              animation: "dots-pop-in 0.25s var(--ease-out-strong) both",
            }}
          >
            No pudimos enviar tu intento. Revisa tu conexión y pulsa ↵ otra vez.
          </p>
        )}

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
              // Acertar la palabra del día es el desenlace del juego y aparecía
              // como una tarjeta estática, sin un solo fotograma de celebración
              animation: "dots-pop-in 0.4s var(--ease-out-strong) both",
            }}
          >
            {state.won ? (
              <>
                <p
                  style={{
                    fontSize: "1.5rem",
                    margin: 0,
                    animation:
                      "dots-star-spin 0.8s var(--ease-out-strong) 0.25s both",
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
                ⏰ Nueva palabra en <strong>{formatCountdown(countdown, "¡Nueva palabra ya disponible!")}</strong>
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
            // El espaciado entre filas lo lleva ahora DailyKeyboard, que es
            // quien sabe cuánto mide su sombra de presión
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: "auto",
              paddingTop: "0.5rem",
              width: "100%",
              maxWidth: "24rem",
            }}
          >
            <DailyKeyboard
              onKey={handleKey}
              marks={keyMarks}
              showEnter
              enterBusy={submitting}
              size="md"
            />
          </div>
        )}
      </div>
    </>
  );
}
