"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import Spinner from "@/components/ui/Spinner/Spinner";
import PronunciationDrill from "@/components/lesson/pronunciation/pronunciation-drill";
import { useAuth } from "@/context/auth-context";
import {
  getNodeContentService,
  type PronunciationContent,
} from "@/services/lessons.service";

function PronunciationClient() {
  const searchParams = useSearchParams();
  const nodeId = Number(searchParams.get("id") ?? "0");
  const { isBootstrapping } = useAuth();

  const [content, setContent] = useState<PronunciationContent | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (isBootstrapping || !nodeId) return;
    getNodeContentService(nodeId)
      .then((data) => {
        if (data.type === "pronunciation") setContent(data);
        else setError(true);
      })
      .catch(() => setError(true));
  }, [nodeId, isBootstrapping]);

  if (error) {
    return (
      <p className="text-center py-10" style={{ color: "var(--muted)" }}>
        No pudimos cargar este ejercicio. Vuelve a intentarlo.
      </p>
    );
  }
  if (!content) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }
  return <PronunciationDrill nodeId={nodeId} content={content} />;
}

export default function PronunciationPage() {
  return (
    <main className="mx-auto w-full max-w-xl flex flex-col gap-4 p-4">
      <Suspense
        fallback={
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        }
      >
        <PronunciationClient />
      </Suspense>
    </main>
  );
}
