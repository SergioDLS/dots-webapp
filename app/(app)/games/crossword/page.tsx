"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getCrosswordService,
  postCrosswordCheckService,
  type CrosswordSlot,
  type CrosswordState,
  type CrosswordCheckResponse,
} from "@/services/games.service";

// ── Constants ─────────────────────────────────────────────────────────────────

const GRID_SIZE = 5;
const MAX_CHECKS = 5;

// QWERTY keyboard rows — no Enter (check uses a button), ⌫ at end of row 3
const KB_ROW1 = ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"];
const KB_ROW2 = ["A", "S", "D", "F", "G", "H", "J", "K", "L"];
const KB_ROW3 = ["Z", "X", "C", "V", "B", "N", "M"];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Seconds until next UTC midnight. */
function secondsUntilMidnightUTC(): number {
  const now = new Date();
  const tomorrow = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
    ),
  );
  return Math.max(0, Math.floor((tomorrow.getTime() - now.getTime()) / 1000));
}

function formatCountdown(secs: number): string {
  if (secs <= 0) return "¡Nuevo crucigrama ya disponible!";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m} min`;
  return "menos de 1 min";
}

/** All [row, col] coordinates covered by a slot, in order. */
function slotCells(slot: CrosswordSlot): [number, number][] {
  const result: [number, number][] = [];
  for (let i = 0; i < slot.len; i++) {
    if (slot.dir === "A") result.push([slot.row, slot.col + i]);
    else result.push([slot.row + i, slot.col]);
  }
  return result;
}

/** Build a Set<"r,c"> of all cells that belong to at least one slot. */
function slotCellSet(slots: CrosswordSlot[]): Set<string> {
  const s = new Set<string>();
  for (const slot of slots) {
    for (const [r, c] of slotCells(slot)) s.add(`${r},${c}`);
  }
  return s;
}

/** Return a slot label string like "3A" or "1D". */
function slotLabel(slot: CrosswordSlot): string {
  return `${slot.id}${slot.dir}`;
}

/**
 * Given a tapped cell and the current selection, determine which slot to
 * activate and which direction.
 *
 * Rules:
 * 1. If the tapped cell is not in the current slot → prefer the slot that
 *    has the same direction as the current one; if none, take the first.
 * 2. If the tapped cell IS the active cell → toggle direction (A↔D) if
 *    the cell belongs to slots of both directions.
 */
function pickSlot(
  slots: CrosswordSlot[],
  row: number,
  col: number,
  currentSlotId: number | null,
  currentDir: "A" | "D",
): CrosswordSlot | null {
  const covering = slots.filter((sl) =>
    slotCells(sl).some(([r, c]) => r === row && c === col),
  );
  if (covering.length === 0) return null;
  if (covering.length === 1) return covering[0];

  const isSameCell =
    currentSlotId !== null &&
    covering.some((sl) => sl.id === currentSlotId);

  if (isSameCell) {
    // Toggle direction
    const toggleDir: "A" | "D" = currentDir === "A" ? "D" : "A";
    const toggled = covering.find((sl) => sl.dir === toggleDir);
    return toggled ?? covering[0];
  }

  // Prefer same direction as current
  const sameDir = covering.find((sl) => sl.dir === currentDir);
  return sameDir ?? covering[0];
}

/** Next cell position in a slot after `offset`; null if at end. */
function nextCellInSlot(
  slot: CrosswordSlot,
  offset: number,
): [number, number] | null {
  if (offset + 1 >= slot.len) return null;
  if (slot.dir === "A") return [slot.row, slot.col + offset + 1];
  return [slot.row + offset + 1, slot.col];
}

/** Previous cell position in slot before `offset`; null if at start. */
function prevCellInSlot(
  slot: CrosswordSlot,
  offset: number,
): [number, number] | null {
  if (offset - 1 < 0) return null;
  if (slot.dir === "A") return [slot.row, slot.col + offset - 1];
  return [slot.row + offset - 1, slot.col];
}

/** Offset of [row,col] within slot; -1 if not in slot. */
function offsetInSlot(slot: CrosswordSlot, row: number, col: number): number {
  const c = slotCells(slot);
  return c.findIndex(([r, cc]) => r === row && cc === col);
}

// ── Sub-components ────────────────────────────────────────────────────────────

type CellProps = {
  letter: string | null;
  isBlack: boolean;
  isActive: boolean;     // cursor is here
  isHighlighted: boolean; // belongs to active slot
  correctState: "correct" | "incorrect" | "neutral"; // tint from last check
  isAnswer: boolean;     // revealed answer (done-lost) — show in distinct style
  slotNumber?: number;   // small number label in corner
  onTap: () => void;
};

function Cell({
  letter,
  isBlack,
  isActive,
  isHighlighted,
  correctState,
  isAnswer,
  slotNumber,
  onTap,
}: CellProps) {
  if (isBlack) {
    return (
      <div
        style={{
          width: "3rem",
          height: "3rem",
          background: "var(--foreground)",
          borderRadius: "0.25rem",
          opacity: 0.85,
        }}
      />
    );
  }

  const bg = isActive
    ? "var(--accent)"
    : isHighlighted
      ? "color-mix(in srgb, var(--accent) 18%, var(--surface))"
      : correctState === "correct"
        ? "color-mix(in srgb, #22c55e 20%, var(--surface))"
        : correctState === "incorrect"
          ? "color-mix(in srgb, #ef4444 15%, var(--surface))"
          : isAnswer
            ? "color-mix(in srgb, #f59e0b 20%, var(--surface))"
            : "var(--surface)";

  const border = isActive
    ? "2px solid var(--accent)"
    : correctState === "correct"
      ? "2px solid #22c55e"
      : correctState === "incorrect"
        ? "2px solid #ef4444"
        : isAnswer
          ? "2px solid #f59e0b"
          : "2px solid var(--border)";

  const textColor = isActive
    ? "var(--accent-foreground)"
    : isAnswer
      ? "#b45309"
      : "var(--foreground)";

  return (
    <div
      onPointerUp={onTap}
      style={{
        width: "3rem",
        height: "3rem",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border,
        borderRadius: "0.25rem",
        background: bg,
        cursor: "pointer",
        userSelect: "none",
        transition: "background 0.15s, border-color 0.15s",
      }}
    >
      {slotNumber !== undefined && (
        <span
          style={{
            position: "absolute",
            top: "1px",
            left: "2px",
            fontSize: "0.55rem",
            fontWeight: 700,
            color: isActive ? "var(--accent-foreground)" : "var(--muted)",
            lineHeight: 1,
          }}
        >
          {slotNumber}
        </span>
      )}
      <span
        style={{
          fontWeight: 800,
          fontSize: "1.1rem",
          fontFamily: "var(--font-display, sans-serif)",
          color: textColor,
        }}
      >
        {letter ?? ""}
      </span>
    </div>
  );
}

type KeyProps = { label: string; onTap: () => void; wide?: boolean };

function Key({ label, onTap, wide }: KeyProps) {
  return (
    <button
      onPointerUp={onTap}
      style={{
        minWidth: wide ? "3.5rem" : "2rem",
        height: "3rem",
        padding: "0 0.2rem",
        border: "none",
        borderRadius: "0.4rem",
        background: "var(--surface)",
        color: "var(--foreground)",
        fontWeight: 700,
        fontSize: wide ? "0.7rem" : "0.875rem",
        cursor: "pointer",
        userSelect: "none",
        flexShrink: 0,
        transition: "opacity 0.1s",
      }}
    >
      {label}
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CrosswordPage() {
  const router = useRouter();

  const [state, setState] = useState<CrosswordState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Local 5×5 cells (mirrors server state + user edits not yet submitted)
  const [localCells, setLocalCells] = useState<(string | null)[][]>(
    () => Array.from({ length: GRID_SIZE }, () => new Array<string | null>(GRID_SIZE).fill(null)),
  );

  // Correct tint from the last /check response (persists until user edits that cell)
  const [correctGrid, setCorrectGrid] = useState<(boolean | null)[][]>(
    () => Array.from({ length: GRID_SIZE }, () => new Array<boolean | null>(GRID_SIZE).fill(null)),
  );

  // Active selection
  const [activeSlotId, setActiveSlotId] = useState<number | null>(null);
  const [activeDir, setActiveDir] = useState<"A" | "D">("A");
  const [activeCursor, setActiveCursor] = useState<[number, number] | null>(null);

  // Submitting guard
  const submittingRef = useRef(false);

  // Countdown
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadState = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    getCrosswordService()
      .then((s) => {
        setState(s);
        // Restore server cells
        setLocalCells(
          s.cells.map((row) => [...row]),
        );
        setCorrectGrid(
          Array.from({ length: GRID_SIZE }, () =>
            new Array<boolean | null>(GRID_SIZE).fill(null),
          ),
        );
        setLoading(false);
      })
      .catch(() => {
        setLoadError(true);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    let active = true;
    getCrosswordService()
      .then((s) => {
        if (!active) return;
        setState(s);
        setLocalCells(s.cells.map((row) => [...row]));
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setLoadError(true);
        setLoading(false);
      });
    return () => { active = false; };
  }, []);

  // Countdown when done
  const isDone = state?.done ?? false;
  useEffect(() => {
    if (!isDone) return;
    const tick = () => setCountdown(secondsUntilMidnightUTC());
    const initId = setTimeout(tick, 0);
    const id = setInterval(tick, 60_000);
    countdownRef.current = id;
    return () => { clearInterval(id); clearTimeout(initId); };
  }, [isDone]);

  useEffect(() => {
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────

  const slots = useMemo(() => state?.slots ?? [], [state?.slots]);
  const done = state?.done ?? false;
  const won = state?.won ?? false;
  const checksUsed = state?.checksUsed ?? 0;
  const checksLeft = MAX_CHECKS - checksUsed;

  const whiteCells = slotCellSet(slots);

  // Map "r,c" → smallest slot id that starts there (for the corner label)
  const cornerNumbers = new Map<string, number>();
  for (const slot of slots) {
    const key = `${slot.row},${slot.col}`;
    if (!cornerNumbers.has(key) || slot.id < cornerNumbers.get(key)!) {
      cornerNumbers.set(key, slot.id);
    }
  }

  const activeSlot = slots.find((sl) => sl.id === activeSlotId) ?? null;
  const highlightedCells = activeSlot ? new Set(slotCells(activeSlot).map(([r, c]) => `${r},${c}`)) : new Set<string>();

  // Build answer map when done
  const answerMap = new Map<string, string>();
  if (done && state?.answers) {
    for (const ans of state.answers) {
      const slot = slots.find((sl) => sl.id === ans.id);
      if (!slot) continue;
      for (let i = 0; i < slot.len; i++) {
        const r = slot.dir === "A" ? slot.row : slot.row + i;
        const c = slot.dir === "A" ? slot.col + i : slot.col;
        answerMap.set(`${r},${c}`, ans.answer[i]);
      }
    }
  }

  // Active clue label
  const activeClue = activeSlot
    ? `${slotLabel(activeSlot)} · ${activeSlot.clueEs}`
    : null;

  // ── Cell tap ──────────────────────────────────────────────────────────────

  const handleCellTap = useCallback(
    (row: number, col: number) => {
      if (done) return;
      if (!whiteCells.has(`${row},${col}`)) return;

      const picked = pickSlot(slots, row, col, activeSlotId, activeDir);
      if (!picked) return;

      setActiveSlotId(picked.id);
      setActiveDir(picked.dir);
      setActiveCursor([row, col]);
    },
    [done, whiteCells, slots, activeSlotId, activeDir],
  );

  // ── Key handler ───────────────────────────────────────────────────────────

  const handleKey = useCallback(
    (key: string) => {
      if (done) return;
      if (!activeSlot || !activeCursor) return;

      const [curRow, curCol] = activeCursor;
      const offset = offsetInSlot(activeSlot, curRow, curCol);
      if (offset === -1) return;

      if (key === "⌫") {
        // Clear current cell then move back
        setLocalCells((prev) => {
          const next = prev.map((r) => [...r]);
          next[curRow][curCol] = null;
          return next;
        });
        // Clear tint for this cell
        setCorrectGrid((prev) => {
          const next = prev.map((r) => [...r]);
          next[curRow][curCol] = null;
          return next;
        });
        const prev = prevCellInSlot(activeSlot, offset);
        if (prev) setActiveCursor(prev);
        return;
      }

      if (/^[A-Z]$/.test(key)) {
        setLocalCells((prev) => {
          const next = prev.map((r) => [...r]);
          next[curRow][curCol] = key;
          return next;
        });
        // Clear tint when user edits
        setCorrectGrid((prev) => {
          const next = prev.map((r) => [...r]);
          next[curRow][curCol] = null;
          return next;
        });
        // Auto-advance
        const next = nextCellInSlot(activeSlot, offset);
        if (next) setActiveCursor(next);
      }
    },
    [done, activeSlot, activeCursor],
  );

  // ── Check ─────────────────────────────────────────────────────────────────

  const handleCheck = useCallback(() => {
    if (done || submittingRef.current) return;
    submittingRef.current = true;

    postCrosswordCheckService(localCells)
      .then((res: CrosswordCheckResponse) => {
        setState(res);
        setLocalCells(res.cells.map((row) => [...row]));
        setCorrectGrid(res.correct.map((row) => [...row]) as (boolean | null)[][]);
      })
      .catch(() => {
        // Silently ignore — server state preserved
      })
      .finally(() => {
        submittingRef.current = false;
      });
  }, [done, localCells]);

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
          Cargando crucigrama de hoy…
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
          No se pudo cargar el crucigrama de hoy.
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

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes cw-pop {
          0% { transform: scale(0.85); opacity: 0; }
          60% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
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
            maxWidth: "22rem",
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
              Mini Crucigrama ✏️
            </p>
            <p style={{ color: "var(--muted)", fontSize: "0.7rem", margin: 0 }}>
              {checksLeft} comprobaciones restantes
            </p>
          </div>
          <div style={{ width: "3rem" }} />
        </div>

        {/* ── Active clue ────────────────────────────────────────────────── */}
        <div
          style={{
            width: "100%",
            maxWidth: "22rem",
            minHeight: "2.5rem",
            background: activeClue
              ? "color-mix(in srgb, var(--accent) 12%, var(--surface))"
              : "var(--surface)",
            border: "1.5px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "0.5rem 1rem",
            textAlign: "center",
            fontSize: "0.85rem",
            color: "var(--foreground)",
            fontWeight: activeClue ? 600 : 400,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 0.2s",
          }}
        >
          {activeClue ? (
            <span>
              <strong>{activeClue.split(" · ")[0]}</strong>
              {" · "}
              {activeClue.split(" · ").slice(1).join(" · ")}
            </span>
          ) : (
            <span style={{ color: "var(--muted)" }}>
              Toca una casilla para ver la pista
            </span>
          )}
        </div>

        {/* ── Grid ────────────────────────────────────────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${GRID_SIZE}, 3rem)`,
            gridTemplateRows: `repeat(${GRID_SIZE}, 3rem)`,
            gap: "0.25rem",
          }}
        >
          {Array.from({ length: GRID_SIZE }, (_, row) =>
            Array.from({ length: GRID_SIZE }, (_, col) => {
              const key = `${row},${col}`;
              const isBlack = !whiteCells.has(key);
              const isActive =
                activeCursor !== null &&
                activeCursor[0] === row &&
                activeCursor[1] === col;
              const isHighlighted = highlightedCells.has(key);
              const letter = done && !won && answerMap.has(key)
                ? answerMap.get(key)!
                : (localCells[row]?.[col] ?? null);
              const isAnswer = done && !won && answerMap.has(key);

              const cState = correctGrid[row]?.[col];
              const correctState: "correct" | "incorrect" | "neutral" =
                cState === true
                  ? "correct"
                  : cState === false && whiteCells.has(key)
                    ? "incorrect"
                    : "neutral";

              const cornerNum = cornerNumbers.get(key);

              return (
                <Cell
                  key={key}
                  letter={letter}
                  isBlack={isBlack}
                  isActive={isActive}
                  isHighlighted={isHighlighted}
                  correctState={correctState}
                  isAnswer={isAnswer}
                  slotNumber={cornerNum}
                  onTap={() => handleCellTap(row, col)}
                />
              );
            }),
          )}
        </div>

        {/* ── Done card ───────────────────────────────────────────────────── */}
        {done && (
          <div
            style={{
              background: "var(--surface)",
              border: "1.5px solid var(--border)",
              borderRadius: "1rem",
              padding: "1rem 1.25rem",
              maxWidth: "22rem",
              width: "100%",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              animation: "cw-pop 0.4s ease both",
            }}
          >
            {won ? (
              <>
                <p style={{ fontSize: "1.5rem", margin: 0 }}>🎉</p>
                <p
                  style={{
                    fontWeight: 900,
                    fontSize: "1rem",
                    color: "#22c55e",
                    margin: 0,
                  }}
                >
                  ¡Crucigrama completado!
                </p>
                <p style={{ color: "var(--muted)", fontSize: "0.8rem", margin: 0 }}>
                  Lo lograste con {checksUsed}{" "}
                  {checksUsed === 1 ? "comprobación" : "comprobaciones"} •{" "}
                  {Math.max(50, 300 - (checksUsed - 1) * 50)} pts
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
                  ¡Mañana lo logras!
                </p>
                <p style={{ color: "var(--muted)", fontSize: "0.8rem", margin: 0 }}>
                  Las respuestas están en el tablero en naranja.
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
                ⏰ Nuevo crucigrama en{" "}
                <strong>{formatCountdown(countdown)}</strong>
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

        {/* ── Check button ─────────────────────────────────────────────────── */}
        {!done && (
          <button
            onPointerUp={handleCheck}
            style={{
              background: checksLeft > 0 ? "var(--accent)" : "var(--muted)",
              color: "var(--accent-foreground)",
              border: "none",
              borderRadius: "1rem",
              padding: "0.75rem 2rem",
              fontWeight: 700,
              fontSize: "0.95rem",
              cursor: checksLeft > 0 ? "pointer" : "default",
              maxWidth: "22rem",
              width: "100%",
              opacity: checksLeft > 0 ? 1 : 0.6,
            }}
          >
            Comprobar ({checksLeft} restante{checksLeft !== 1 ? "s" : ""})
          </button>
        )}

        {/* ── On-screen keyboard ──────────────────────────────────────────── */}
        {!done && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.3rem",
              marginTop: "auto",
              paddingTop: "0.5rem",
              width: "100%",
              maxWidth: "22rem",
            }}
          >
            <div style={{ display: "flex", gap: "0.2rem", justifyContent: "center" }}>
              {KB_ROW1.map((k) => (
                <Key key={k} label={k} onTap={() => handleKey(k)} />
              ))}
            </div>
            <div style={{ display: "flex", gap: "0.2rem", justifyContent: "center" }}>
              {KB_ROW2.map((k) => (
                <Key key={k} label={k} onTap={() => handleKey(k)} />
              ))}
            </div>
            <div style={{ display: "flex", gap: "0.2rem", justifyContent: "center" }}>
              {KB_ROW3.map((k) => (
                <Key key={k} label={k} onTap={() => handleKey(k)} />
              ))}
              <Key label="⌫" wide onTap={() => handleKey("⌫")} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
