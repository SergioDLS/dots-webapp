"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import Doty from "@/components/ui/doty/doty";
import Spinner from "@/components/ui/Spinner/Spinner";
import UIButton from "@/components/ui/button/button";
import { PanelWrapper, SectionLabel } from "@/components/lesson/panel";
import CheckpointExam from "@/components/checkpoint/checkpoint-exam";
import CheckpointResult from "@/components/checkpoint/checkpoint-result";
import { useAuth } from "@/context/auth-context";
import {
  startCheckpointService,
  submitCheckpointService,
  type CheckpointResult as CheckpointResultData,
  type CheckpointStart,
} from "@/services/lessons.service";

function CheckpointClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sectionId = Number(searchParams.get("id") ?? "0");
  const { isBootstrapping } = useAuth();

  const [exam, setExam] = useState<CheckpointStart | null>(null);
  const [result, setResult] = useState<CheckpointResultData | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goToPath = () => router.push("/levels");

  const start = () => {
    setStarting(true);
    setError(null);
    startCheckpointService(sectionId)
      .then(setExam)
      .catch((e) => {
        const status = e?.response?.status;
        setError(
          status === 429
            ? "Alcanzaste el límite de 3 intentos por hoy. ¡Vuelve mañana!"
            : "No se pudo iniciar el checkpoint. ¿Ya superaste esta sección?",
        );
      })
      .finally(() => setStarting(false));
  };

  const submit = (answers: { sentenceId: number; word: string }[]) => {
    if (!exam) return;
    submitCheckpointService(sectionId, exam.attemptId, answers)
      .then(setResult)
      .catch(() => setError("No se pudo enviar el examen. Inténtalo de nuevo."));
  };

  if (isBootstrapping || !sectionId) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (result) {
    return (
      <CheckpointResult
        result={result}
        onRetry={() => {
          setResult(null);
          setExam(null);
        }}
        onExit={goToPath}
      />
    );
  }

  if (exam) {
    return <CheckpointExam exam={exam} onSubmit={submit} onExit={goToPath} />;
  }

  return (
    <PanelWrapper>
      <SectionLabel emoji="🏁">Checkpoint</SectionLabel>
      <Doty pose="07" size="small" say="¿Listo para demostrar lo que sabes?" />
      <div className="flex flex-col gap-2 text-sm text-center" style={{ color: "var(--muted)" }}>
        <p>Un examen corto de la sección: sin pistas y sin ayuda.</p>
        <p>
          Si aciertas el <b>85% o más</b>, saltas la sección completa y sigues
          adelante en el camino.
        </p>
        <p>Tienes 3 intentos por día.</p>
      </div>
      {error && (
        <p className="text-center text-sm font-bold" style={{ color: "#ef4444" }}>
          {error}
        </p>
      )}
      <div className="flex gap-3 w-full">
        <UIButton tone="neutral" onClick={goToPath}>
          ← Volver
        </UIButton>
        <UIButton tone="accent" onClick={start} disabled={starting} fullWidth>
          {starting ? "Preparando..." : "Empezar el examen"}
        </UIButton>
      </div>
    </PanelWrapper>
  );
}

export default function CheckpointPage() {
  return (
    <main className="mx-auto w-full max-w-xl flex flex-col gap-4 p-4">
      <Suspense
        fallback={
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        }
      >
        <CheckpointClient />
      </Suspense>
    </main>
  );
}
