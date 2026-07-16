"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Difficulty from "./difficulty/difficulty";
import Spinner from "@/components/ui/Spinner/Spinner";
import Doty from "@/components/ui/doty/doty";
import { getLevelsService } from "@/services/levels.service";
import { useAuth } from "@/context/auth-context";
import type { Difficulty as DifficultyType } from "@/types/levels.types";

export default function LevelContainer() {
  // Client-side fetch: the session cookie belongs to the API host, so the
  // Next server never receives it — only the browser (via the shared api
  // client with the in-memory token + refresh flow) can call /levels.
  const { isBootstrapping } = useAuth();
  const [levels, setLevels] = useState<DifficultyType[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (isBootstrapping) return; // wait for auth to finish before calling API
    let mounted = true;
    getLevelsService()
      .then((data) => {
        if (!mounted) return;
        setLevels(Array.isArray(data) ? data : (data?.levels ?? []));
      })
      .catch(() => {
        if (mounted) setError(true);
      });
    return () => {
      mounted = false;
    };
  }, [isBootstrapping]);

  if (error) {
    return (
      <div className="dots-card mx-auto flex w-full max-w-md flex-col items-center gap-4 px-6 py-10 text-center">
        <Doty pose="05" size="tiny" />
        <h2 className="font-display text-2xl font-extrabold text-foreground">
          Could not load levels
        </h2>
        <p className="text-sm font-semibold text-(--muted)">
          There was a problem loading your levels. Please make sure you are
          logged in and try again.
        </p>
        <Link
          href="/"
          className="dots-pressable rounded-2xl bg-(--accent) px-6 py-3 text-sm font-extrabold text-(--accent-contrast) [--press-color:var(--accent-edge)]"
        >
          Go to login
        </Link>
      </div>
    );
  }

  if (!levels) {
    return <Spinner title="Loading levels..." />;
  }

  return (
    <div className="w-full">
      <div className="flex flex-col gap-8">
        {levels.map((item) => (
          <Difficulty
            key={item.id}
            idLevel={item.id}
            pose={item.img}
            enabled={item.enabled}
            name={item.name}
            sections={item.sections}
            progress={item.progress}
          />
        ))}
      </div>
    </div>
  );
}
