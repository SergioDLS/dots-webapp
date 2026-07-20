"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Spinner from "@/components/ui/Spinner/Spinner";
import Doty from "@/components/ui/doty/doty";
import PathDifficulty from "./path-difficulty";
import { getLevelsService, getPathService } from "@/services/levels.service";
import { adaptLevelsToPath } from "@/lib/path-adapter";
import { useAuth } from "@/context/auth-context";
import type { PathResponse } from "@/types/path.types";

/** Exactly ONE current node: the first unlocked, non-completed, non-checkpoint one. */
function normalizeCurrent(data: PathResponse): PathResponse {
  let found = false;
  return {
    ...data,
    difficulties: data.difficulties.map((d) => ({
      ...d,
      sections: d.sections.map((s) => ({
        ...s,
        nodes: s.nodes.map((n) => {
          const isCurrent =
            !found && n.unlocked && !n.completed && n.type !== "checkpoint";
          if (isCurrent) found = true;
          return { ...n, current: isCurrent };
        }),
      })),
    })),
  };
}

export default function PathContainer() {
  // Client-side fetch: the session cookie belongs to the API host, so only
  // the browser (shared api client + refresh flow) can call the API.
  const { isBootstrapping } = useAuth();
  const router = useRouter();
  const [path, setPath] = useState<PathResponse | null>(null);
  const [error, setError] = useState(false);
  const scrolledRef = useRef(false);

  useEffect(() => {
    if (isBootstrapping) return;
    let mounted = true;
    (async () => {
      try {
        const data = await getPathService();
        if (mounted) setPath(normalizeCurrent(data));
      } catch {
        // Silent fallback: /path is not deployed yet → adapt /levels
        console.warn("GET /path unavailable, falling back to /levels + adapter");
        try {
          const data = await getLevelsService();
          const list = Array.isArray(data) ? data : (data?.levels ?? []);
          if (mounted) setPath(normalizeCurrent(adaptLevelsToPath(list)));
        } catch {
          if (mounted) setError(true);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [isBootstrapping]);

  // Brand-new accounts (no placement record, zero progress) go through
  // onboarding first. Fail-open by design: the adapter fallback and any
  // error path leave placementPending=false, so existing users are never
  // trapped in onboarding.
  useEffect(() => {
    if (path?.placementPending) router.replace("/onboarding");
  }, [path?.placementPending, router]);

  // Auto-scroll to the current node once the path is rendered
  useEffect(() => {
    if (!path || scrolledRef.current) return;
    scrolledRef.current = true;
    const t = setTimeout(() => {
      document
        .querySelector('[data-path-current="true"]')
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 300);
    return () => clearTimeout(t);
  }, [path]);

  if (error) {
    return (
      <div className="dots-card mx-auto flex w-full max-w-md flex-col items-center gap-4 px-6 py-10 text-center">
        <Doty pose="05" size="tiny" />
        <h2 className="font-display text-2xl font-extrabold text-foreground">
          No pudimos cargar tu camino
        </h2>
        <p className="text-sm font-semibold text-(--muted)">
          Hubo un problema al cargar tu progreso. Asegúrate de haber iniciado
          sesión e inténtalo de nuevo.
        </p>
        <Link
          href="/"
          className="dots-pressable rounded-2xl bg-(--accent) px-6 py-3 text-sm font-extrabold text-(--accent-contrast) [--press-color:var(--accent-edge)]"
        >
          Ir al login
        </Link>
      </div>
    );
  }

  if (!path) {
    return <Spinner title="Cargando tu camino..." />;
  }

  return (
    <div className="w-full">
      <div className="flex flex-col gap-8">
        {path.difficulties.map((difficulty) => (
          <PathDifficulty key={difficulty.id} difficulty={difficulty} />
        ))}
      </div>
    </div>
  );
}
