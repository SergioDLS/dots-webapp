"use client";

import { useMemo, useState } from "react";

import Doty from "@/components/ui/doty/doty";
import { Icon } from "@/components/ui/icon";
import { PanelWrapper, SectionLabel } from "@/components/lesson/panel";
import {
  baseOptionCls,
  optionStyles,
} from "@/components/lesson/option-styles";
import LessonFooter from "@/components/lesson/lesson-footer";
import LessonTopBar from "@/components/lesson/lesson-top-bar";
import { usePublicarObjetivos } from "@/hooks/use-report-targets";
import { conRespuesta, objetivoDeOracion } from "@/lib/report";
import { registrarRespondido } from "@/lib/report-targets";
import {
  answerPlacementService,
  type PlacementQuestion,
  type PlacementResult,
  type PlacementStart,
} from "@/services/placement.service";

interface Props {
  test: PlacementStart;
  onFinished: (result: PlacementResult) => void;
}

/** La pregunta de la prueba como objetivo de reporte: la misma para lo que se publica y lo que se registra. */
const objetivoDeNivelacion = (q: PlacementQuestion, testId: number) =>
  objetivoDeOracion({ id: q.sentenceId, text: q.text, options: q.options }, "placement", {
    context: { testId },
  });

/**
 * Adaptive test, one question at a time. Deliberately silent: no
 * right/wrong feedback per question — the answer just moves the ladder.
 */
export default function PlacementTest({ test, onFinished }: Props) {
  const [question, setQuestion] = useState(test.question);
  const [questionNumber, setQuestionNumber] = useState(test.questionNumber);
  const [selected, setSelected] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const confirm = () => {
    if (selected === null || sending) return;
    // `wasWrong: null` y sin `expected`, aunque la respuesta del servidor traiga
    // `correct`: la prueba es muda a propósito y reportar no debe delatar si
    // acertaste.
    registrarRespondido(
      conRespuesta(objetivoDeNivelacion(question, test.testId), { answer: selected, wasWrong: null }),
    );
    setSending(true);
    answerPlacementService(test.testId, question.sentenceId, selected)
      .then((res) => {
        setSelected(null);
        if (res.finished && res.result) {
          onFinished(res.result);
        } else if (res.question) {
          setQuestion(res.question);
          setQuestionNumber(res.questionNumber ?? questionNumber + 1);
        }
      })
      .catch(console.error)
      .finally(() => setSending(false));
  };

  // Reportes (spec 2026-10-01): la pregunta en pantalla, con la opción elegida
  // pero sin decir si acierta (`wasWrong: null`: así no sale «debería estar bien»).
  const objetivos = useMemo(() => {
    const base = objetivoDeNivelacion(question, test.testId);
    return [selected === null ? base : conRespuesta(base, { answer: selected, wasWrong: null })];
  }, [question, selected, test.testId]);
  usePublicarObjetivos(objetivos);

  return (
    <div className="flex flex-col gap-4 w-full">
      <LessonTopBar
        progress={Math.floor(((questionNumber - 1) / test.maxQuestions) * 100)}
      />
      <PanelWrapper>
        <SectionLabel emoji={<Icon name="brujula" size={20} />}>
          {`Pregunta ${questionNumber} · máximo ${test.maxQuestions}`}
        </SectionLabel>
        <p className="font-display text-xl font-extrabold text-center leading-relaxed">
          {question.text.split("__").map((part, i, arr) => (
            <span key={i}>
              {part}
              {i < arr.length - 1 && (
                <span
                  className="inline-block min-w-16 border-b-4 mx-1 align-baseline"
                  style={{ borderColor: "var(--accent)" }}
                >
                  {selected ? (
                    <span style={{ color: "var(--accent)" }}>{selected}</span>
                  ) : (
                    " "
                  )}
                </span>
              )}
            </span>
          ))}
        </p>
        <div className="grid grid-cols-2 gap-3 w-full">
          {question.options.map((word) => (
            <button
              key={word}
              className={baseOptionCls}
              style={optionStyles[selected === word ? "selected" : "idle"]}
              onClick={() => setSelected(word)}
            >
              {word}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
          <Doty pose="pensando" size="mini" />
          <span>Responde tranquilo: la prueba se adapta a ti.</span>
        </div>
      </PanelWrapper>
      <LessonFooter
        confirmLabel={sending ? "Enviando..." : "Confirmar"}
        confirmDisabled={selected === null || sending}
        onExit={() => window.history.back()}
        avisoSalida={"Perderás tus respuestas y la nivelación empezará de cero."}
        onConfirm={confirm}
      />
    </div>
  );
}
