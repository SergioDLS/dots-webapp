"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import ExitFlow from "@/components/ui/exit-flow/exit-flow";
import { useParams, useRouter } from "next/navigation";
import Doty from "@/components/ui/doty/doty";
import Confetti from "@/components/ui/confetti/confetti";
import UIButton from "@/components/ui/button/button";
import Spinner from "@/components/ui/Spinner/Spinner";
import { useAuth } from "@/context/auth-context";
import { BASE_URL_SOUNDS } from "@/constants";
import {
  getReadingService,
  completeReadingService,
  type ReadingDetail,
  type ReadingResult,
} from "@/services/engagement.service";

type Stage = "read" | "quiz" | "result";

export default function ReadingPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "0";
  const { isBootstrapping } = useAuth();

  const [reading, setReading] = useState<ReadingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [stage, setStage] = useState<Stage>("read");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ReadingResult | null>(null);

  useEffect(() => {
    if (isBootstrapping) return;
    let active = true;
    getReadingService(id)
      .then((data) => active && setReading(data))
      .catch(() => active && setFailed(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id, isBootstrapping]);

  // stable question order (quiz answers are matched by idx server-side)
  const quiz = useMemo(
    () => (reading ? [...reading.quiz].sort((a, b) => a.idx - b.idx) : []),
    [reading],
  );

  const allAnswered = quiz.length > 0 && quiz.every((q) => answers[q.idx] !== undefined);

  const audioSrc = reading?.src
    ? /^https?:\/\//.test(reading.src)
      ? reading.src
      : `${BASE_URL_SOUNDS}/${reading.src}`
    : null;

  const goToLevels = () => router.push("/levels");

  const submit = () => {
    if (!allAnswered || submitting) return;
    setSubmitting(true);
    completeReadingService(id, quiz.map((q) => answers[q.idx]))
      .then((res) => {
        setResult(res);
        setStage("result");
      })
      .catch(() => setFailed(true))
      .finally(() => setSubmitting(false));
  };

  const retry = () => {
    setAnswers({});
    setResult(null);
    setStage("read");
  };

  if (loading || isBootstrapping) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner title="Abriendo el libro..." />
      </div>
    );
  }

  if (failed || !reading) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-5 px-4">
        <Doty pose="oh-no" size="small" animation="sad" />
        <p className="text-sm font-semibold text-(--muted)">
          No pudimos abrir esta lectura. Inténtalo de nuevo más tarde.
        </p>
        <UIButton tone="neutral" onClick={goToLevels}>
          ← Volver al camino
        </UIButton>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-svh w-full flex-col items-center overflow-hidden px-4 py-6">
      {/* ambient blob */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--accent)" }}
      />

      {/* Top bar */}
      <div className="dots-card z-10 flex w-full max-w-2xl items-center justify-between gap-3 px-4 py-3">
        {/* compacto: misma barra estrecha que el HUD de los juegos. */}
        <ExitFlow onExit={goToLevels} aviso="Perderás tu avance en esta lectura." compacto />
        <span className="font-display text-lg font-extrabold text-(--accent) truncate">
          {reading.title}
        </span>
        {/* El mismo icono con el que el Camino marca un nodo de lectura
            (lib/path-node-meta.ts). Un emoji aqui lo dibujaba el sistema
            operativo: distinto en Safari de iPhone que en escritorio, y sin
            poder teñirlo (regla 11). */}
        <Icon name="lectura" size={24} />
      </div>

      <div className="relative z-10 mt-4 flex w-full max-w-2xl flex-1 flex-col items-center gap-5">
        {/* ── Stage: read ── */}
        {stage === "read" && (
          <div
            className="dots-card flex w-full flex-col items-center gap-5 px-6 py-8"
            style={{ animation: "dots-slide-up 0.4s ease-out both" }}
          >
            <div className="flex items-end gap-3">
              <Doty pose="leyendo" size="tiny" animation="bob" say="¡Lee conmigo!" />
            </div>
            <h1 className="font-display text-2xl font-extrabold text-foreground text-center">
              {reading.title}
            </h1>

            {audioSrc && (
              <audio
                controls
                src={audioSrc}
                className="w-full max-w-md"
                aria-label={`Listen to ${reading.title}`}
              />
            )}

            <p className="whitespace-pre-line text-base font-semibold leading-relaxed text-foreground">
              {reading.text}
            </p>

            {quiz.length > 0 ? (
              <UIButton tone="accent" onClick={() => setStage("quiz")}>
                ¡Listo para las preguntas! →
              </UIButton>
            ) : (
              <ExitFlow onExit={goToLevels} aviso="Perderás tu avance en esta lectura." />
            )}
          </div>
        )}

        {/* ── Stage: quiz ── */}
        {stage === "quiz" && (
          <div className="flex w-full flex-col gap-4">
            <div className="dots-card flex items-center gap-3 px-5 py-3">
              <Doty pose="pensando" size="mini" />
              <div className="flex flex-col">
                <span className="text-xs font-bold uppercase tracking-widest text-(--muted)">
                  Quiz time!
                </span>
                <span className="text-sm font-semibold text-foreground">
                  Fill in the missing words —{" "}
                  {Object.keys(answers).length}/{quiz.length} answered
                </span>
              </div>
            </div>

            {quiz.map((q, qi) => (
              <div
                key={q.idx}
                className="dots-card flex flex-col gap-3 px-5 py-4"
                style={{ animation: `dots-slide-up 0.35s ease-out both ${qi * 0.05}s` }}
              >
                <p className="text-base font-extrabold text-foreground">
                  <span className="mr-2 text-(--muted)">{qi + 1}.</span>
                  {q.prompt}
                </p>
                <div className="flex flex-wrap gap-2">
                  {q.options.map((opt) => {
                    const selected = answers[q.idx] === opt;
                    return (
                      <button
                        key={opt}
                        onClick={() =>
                          setAnswers((prev) => ({ ...prev, [q.idx]: opt }))
                        }
                        className="dots-pressable rounded-2xl border-2 px-4 py-2 text-sm font-extrabold [--press-color:var(--border)]"
                        style={{
                          background: selected
                            ? "var(--accent)"
                            : "var(--surface)",
                          borderColor: selected ? "var(--accent)" : "var(--border)",
                          color: selected ? "var(--accent-contrast)" : "var(--foreground)",
                          ["--press-color" as string]: selected
                            ? "var(--accent-edge)"
                            : "var(--border)",
                        }}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="flex gap-3 w-full">
              <UIButton tone="neutral" onClick={() => setStage("read")}>
                ← Leer otra vez
              </UIButton>
              <UIButton
                tone="accent"
                fullWidth
                disabled={!allAnswered || submitting}
                onClick={submit}
              >
                {submitting ? "Revisando..." : "¡Revisar mis respuestas!"}
              </UIButton>
            </div>
          </div>
        )}

        {/* ── Stage: result ── */}
        {stage === "result" && result && (
          <div
            className="dots-card relative mt-6 flex w-full max-w-md flex-col items-center gap-5 overflow-hidden px-8 py-10 text-center"
            style={{ animation: "dots-pop-in 0.4s ease-out both" }}
          >
            {result.passed && <Confetti burstKey="reading-pass" count={40} />}
            <Doty
              pose={result.passed ? "lo-lograste" : "triste"}
              size="small"
              animation={result.passed ? "cheer" : "sad"}
              say={result.passed ? "¡Lees de maravilla!" : "¡Vamos a leerlo otra vez!"}
            />
            <h2 className="font-display text-3xl font-extrabold text-foreground">
              {result.passed ? "¡Lo lograste! 🌟" : "¡Casi! 💪"}
            </h2>
            <p className="text-sm font-bold text-(--muted)">
              Acertaste {result.correct} de {result.total}
            </p>
            {result.passed && result.xpGained > 0 && (
              <span
                className="rounded-full px-4 py-1.5 text-sm font-black"
                style={{
                  background: "color-mix(in srgb, var(--gold) 18%, transparent)",
                  border: "2px solid color-mix(in srgb, var(--gold) 45%, transparent)",
                  color: "var(--gold-edge)",
                  animation: "dots-pop-in 0.4s ease-out both",
                }}
              >
                ✨ +{result.xpGained} XP
              </span>
            )}
            <div className="flex w-full max-w-xs flex-col gap-3">
              {!result.passed && (
                <UIButton tone="accent" fullWidth onClick={retry}>
                  Intentar de nuevo
                </UIButton>
              )}
              <UIButton
                tone={result.passed ? "accent" : "neutral"}
                fullWidth
                onClick={goToLevels}
              >
                Volver al camino
              </UIButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
