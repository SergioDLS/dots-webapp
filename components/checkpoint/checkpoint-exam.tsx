"use client";

import { useMemo, useState } from "react";

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
import type { CheckpointQuestion, CheckpointStart } from "@/services/lessons.service";

interface Props {
  exam: CheckpointStart;
  onSubmit: (answers: { sentenceId: number; word: string }[]) => void;
  onExit: () => void;
}

/** La pregunta del examen como objetivo de reporte: la misma para lo que se publica y lo que se registra. */
const objetivoDeExamen = (q: CheckpointQuestion, attemptId: number) =>
  objetivoDeOracion({ id: q.sentenceId, text: q.text, options: q.options }, "checkpoint", {
    context: { attemptId },
  });

/**
 * Exam mode: one question at a time, no feedback, no reveal — the server
 * grades the whole submission at the end (answers never carry `correct`).
 */
export default function CheckpointExam({ exam, onSubmit, onExit }: Props) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answers, setAnswers] = useState<{ sentenceId: number; word: string }[]>([]);

  const question = exam.questions[index];
  const total = exam.questions.length;

  const confirm = () => {
    if (!question || selected === null) return;
    // `wasWrong: null` y sin `expected`: el examen esconde si acertaste (la
    // corrección es del servidor y llega al final).
    registrarRespondido(
      conRespuesta(objetivoDeExamen(question, exam.attemptId), { answer: selected, wasWrong: null }),
    );
    const nextAnswers = [
      ...answers,
      { sentenceId: question.sentenceId, word: selected },
    ];
    setSelected(null);
    if (index + 1 < total) {
      setAnswers(nextAnswers);
      setIndex(index + 1);
    } else {
      onSubmit(nextAnswers);
    }
  };

  // Reportes (spec 2026-10-01): la pregunta en pantalla, con la opción elegida
  // pero sin decir si acierta (`wasWrong: null`: así no sale «debería estar bien»).
  const objetivos = useMemo(() => {
    if (!question) return [];
    const base = objetivoDeExamen(question, exam.attemptId);
    return [selected === null ? base : conRespuesta(base, { answer: selected, wasWrong: null })];
  }, [question, selected, exam.attemptId]);
  usePublicarObjetivos(objetivos);

  if (!question) return null;

  return (
    <div className="flex flex-col gap-4 w-full">
      <LessonTopBar progress={Math.floor((index / total) * 100)} />
      <PanelWrapper>
        <SectionLabel emoji={<Icon name="checkpoint" size={20} />}>
          {`Pregunta ${index + 1} de ${total}`}
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
      </PanelWrapper>
      <LessonFooter
        confirmLabel={index + 1 < total ? "Siguiente" : "Enviar examen"}
        confirmDisabled={selected === null}
        onExit={onExit}
        avisoSalida={"Este intento se perderá, y solo tienes 3 al día."}
        onConfirm={confirm}
      />
    </div>
  );
}
