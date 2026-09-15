"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Spinner from "@/components/ui/Spinner/Spinner";
import Doty from "@/components/ui/doty/doty";
import PathDifficulty, { difficultyColors } from "./path-difficulty";
import LockedDifficulty from "./locked-difficulty";
import FoldedHeader from "./folded-header";
import BackToCurrent from "./back-to-current";
import { getLevelsService, getPathService, getPathNeighborsService } from "@/services/levels.service";
import { adaptLevelsToPath } from "@/lib/path-adapter";
import { useAuth } from "@/context/auth-context";
import { useInView } from "@/hooks/use-in-view";
import {
  difficultyNav,
  isDifficultyUnlocked,
  pickDefaultDifficultyId,
  prettyDifficultyName,
} from "@/lib/path-view";
import type { PathPeer, PathResponse } from "@/types/path.types";

/**
 * Marca exactamente UN nodo actual: el primero desbloqueado y sin completar.
 *
 * SOLO para el fallback de /levels + adapter, que no trae los flags calculados.
 * Cuando GET /path responde, sus flags se respetan tal cual: el backend ya usa
 * la regla buena (path-walk.ts), que además excluye las lecturas — esta versión
 * no, y por eso llegó a dejar que un nodo `reading` se robara la estrella.
 */
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
  // Tracks whether the path came from GET /path (true) or the /levels adapter
  // fallback (false). Peers use path_nodes.id as keys; the adapter uses
  // levels.id — a different id space — so a peer could land on an arbitrary
  // unrelated node if both responses happen to share a number. When the adapter
  // is active, we suppress peers entirely rather than show misleading positions.
  const [pathIsCanonical, setPathIsCanonical] = useState(false);
  const [error, setError] = useState(false);
  const [peersByNodeId, setPeersByNodeId] = useState<
    Record<number, PathPeer[]>
  >({});

  useEffect(() => {
    if (isBootstrapping) return;
    let mounted = true;
    (async () => {
      try {
        const data = await getPathService();
        // El backend ya marca exactamente un `current` con la regla compartida.
        if (mounted) {
          setPath(data);
          setPathIsCanonical(true);
        }
      } catch {
        // Silent fallback: /path is not deployed yet → adapt /levels
        console.warn("GET /path unavailable, falling back to /levels + adapter");
        try {
          const data = await getLevelsService();
          const list = Array.isArray(data) ? data : (data?.levels ?? []);
          // pathIsCanonical stays false: adapter uses levels.id as node ids,
          // which is a different id space from path_nodes.id that peers reference.
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

  // Vecinos en el camino. Adorno deliberado: si falla, se pone lento o no está
  // desplegado, el camino se ve exactamente como hoy. Sin loadError, sin botón
  // de Reintentar y sin ruido para el alumno (excepción consciente a la regla 5
  // del CLAUDE.md, que aplica a fetches que bloquean el juego).
  //
  // pathIsCanonical is in the dep array so this effect re-runs once GET /path
  // succeeds and flips the flag to true. It skips early when false so peers are
  // never drawn over the adapter's level-id nodes.
  useEffect(() => {
    if (isBootstrapping || !pathIsCanonical) return;
    let mounted = true;
    (async () => {
      try {
        const data = await getPathNeighborsService();
        if (!mounted) return;
        const map: Record<number, PathPeer[]> = {};
        for (const peer of [data.ahead, data.behind]) {
          if (!peer) continue;
          (map[peer.nodeId] ??= []).push(peer);
        }
        setPeersByNodeId(map);
      } catch {
        // Silencio intencional.
      }
    })();
    return () => {
      mounted = false;
    };
  }, [isBootstrapping, pathIsCanonical]);

  // Brand-new accounts (no placement record, zero progress) go through
  // onboarding first. Fail-open by design: the adapter fallback and any
  // error path leave placementPending=false, so existing users are never
  // trapped in onboarding.
  useEffect(() => {
    if (path?.placementPending) router.replace("/onboarding");
  }, [path?.placementPending, router]);

  const searchParams = useSearchParams();
  const requested = Number(searchParams.get("d"));
  const difficulties = path?.difficulties ?? [];
  // "Mi nivel": la dificultad current del backend, o la del nodo current, o la primera abierta.
  const currentId = pickDefaultDifficultyId(difficulties);
  const shownId = difficulties.some((d) => d.id === requested) ? requested : currentId;
  const shown = difficulties.find((d) => d.id === shownId) ?? null;
  const preview = shown ? !isDifficultyUnlocked(shown) : false;
  const nav = shownId === null ? null : difficultyNav(difficulties, shownId);
  const bannerRef = useRef<HTMLDivElement>(null);

  const goTo = useCallback(
    (id: number) => {
      // Sin `?d=` para "mi nivel": la URL limpia sigue siendo la del Camino de siempre.
      router.push(id === currentId ? "/levels" : `/levels?d=${id}`);
    },
    [router, currentId],
  );

  const scrolledForRef = useRef<number | null>(null);
  useEffect(() => {
    if (!path || shownId === null || shownId !== currentId) return;
    if (scrolledForRef.current === shownId) return;
    scrolledForRef.current = shownId;
    const t = setTimeout(() => {
      document
        .querySelector('[data-path-current="true"]')
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 300);
    return () => clearTimeout(t);
  }, [path, shownId, currentId]);

  // El banner sale del viewport → cabecera plegada. Margen superior = alto del HUD.
  const bannerInView = useInView(() => bannerRef.current, shownId, { rootMargin: "-64px 0px 0px 0px" });
  // El nodo actual sale del viewport → botón flotante. Si se mira otra dificultad no existe en el DOM.
  const currentInView = useInView(
    () => document.querySelector('[data-path-current="true"]'),
    `${shownId}:${path ? 1 : 0}`,
    { threshold: 0.4 },
  );
  const showBack = shownId !== null && (shownId !== currentId || !currentInView);

  const pendingScrollRef = useRef(false);
  const scrollToCurrent = useCallback(() => {
    document
      .querySelector('[data-path-current="true"]')
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, []);
  const backToCurrent = useCallback(() => {
    if (shownId !== currentId && currentId !== null) {
      pendingScrollRef.current = true;
      goTo(currentId);
      return;
    }
    scrollToCurrent();
  }, [shownId, currentId, goTo, scrollToCurrent]);

  // Tras cambiar a "mi nivel" desde otra dificultad, centrar el nodo cuando ya está pintado.
  useEffect(() => {
    if (!pendingScrollRef.current || shownId !== currentId) return;
    pendingScrollRef.current = false;
    const t = setTimeout(scrollToCurrent, 350);
    return () => clearTimeout(t);
  }, [shownId, currentId, scrollToCurrent]);

  if (error) {
    return (
      <div className="dots-card mx-auto flex w-full max-w-md flex-col items-center gap-4 px-6 py-10 text-center">
        <Doty pose="oh-no" size="tiny" />
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

  if (!shown || nav === null) {
    return <span className="text-(--muted)">No hay dificultades disponibles.</span>;
  }

  const accentHex = difficultyColors(shown.id)[0];
  const locked = difficulties.filter((d) => d.id !== shown.id && !isDifficultyUnlocked(d));

  return (
    <div className="flex w-full flex-col gap-8">
      <PathDifficulty
        difficulty={shown}
        nav={nav}
        accentHex={accentHex}
        peersByNodeId={peersByNodeId}
        preview={preview}
        onGo={goTo}
        bannerRef={bannerRef}
        header={<FoldedHeader difficulty={shown} nav={nav} accentHex={accentHex} visible={!bannerInView} onGo={goTo} />}
        aside={<div className="hidden md:block"><BackToCurrent visible={showBack} onClick={backToCurrent} variant="inline" /></div>}
      />
      <BackToCurrent visible={showBack} onClick={backToCurrent} variant="floating" />

      {locked.length > 0 && (
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
          {locked.map((d) => {
            const i = difficulties.findIndex((x) => x.id === d.id);
            const previous = difficulties[i - 1];
            return (
              <LockedDifficulty
                key={d.id}
                difficulty={d}
                index={i}
                previousName={previous ? prettyDifficultyName(previous.name) : "la dificultad anterior"}
                accentHex={difficultyColors(d.id)[0]}
                onPreview={goTo}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
