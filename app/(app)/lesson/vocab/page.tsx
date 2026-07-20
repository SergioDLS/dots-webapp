"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import Spinner from "@/components/ui/Spinner/Spinner";
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

  useEffect(() => {
    if (isBootstrapping || !nodeId) return;
    getNodeContentService(nodeId)
      .then((data) => {
        if (data.type === "vocab") setContent(data);
        else setError(true);
      })
      .catch(() => setError(true));
  }, [nodeId, isBootstrapping]);

  if (error) {
    return (
      <p className="text-center py-10" style={{ color: "var(--muted)" }}>
        No pudimos cargar este vocabulario. Vuelve a intentarlo.
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
  return <VocabPack nodeId={nodeId} content={content} />;
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
