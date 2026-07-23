"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import Spinner from "@/components/ui/Spinner/Spinner";
import UIButton from "@/components/ui/button/button";
import VocabPack from "@/components/lesson/vocab/vocab-pack";
import { useAuth } from "@/context/auth-context";
import {
  getNodeContentService,
  type VocabContent,
} from "@/services/lessons.service";

function VocabClient() {
  const searchParams = useSearchParams();
  const nodeId = Number(searchParams.get("id") ?? "0");
  const { isBootstrapping } = useAuth();

  const [content, setContent] = useState<VocabContent | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (isBootstrapping || !nodeId) return;
    getNodeContentService(nodeId)
      .then((data) => {
        if (data.type === "vocab") setContent(data);
        else setError(true);
      })
      .catch(() => setError(true));
  }, [nodeId, isBootstrapping, attempt]);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-10">
        <p className="text-center" style={{ color: "var(--muted)" }}>
          No pudimos cargar este vocabulario.
        </p>
        <UIButton
          tone="accent"
          onClick={() => {
            // fetchAttempt retry: bump the counter, the effect re-fetches.
            setError(false);
            setAttempt((a) => a + 1);
          }}
        >
          Reintentar
        </UIButton>
      </div>
    );
  }
  if (!content) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }
  return (
    <VocabPack
      // Remount per fetch: cada sesión arma su propio tramo desde cero.
      key={attempt}
      nodeId={nodeId}
      content={content}
      onRestart={() => {
        // "Seguir practicando": re-fetch → dominio fresco → tramo nuevo.
        setContent(null);
        setAttempt((a) => a + 1);
      }}
    />
  );
}

export default function VocabPage() {
  return (
    <main className="mx-auto w-full max-w-xl flex flex-col gap-4 p-4">
      <Suspense
        fallback={
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        }
      >
        <VocabClient />
      </Suspense>
    </main>
  );
}
