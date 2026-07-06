"use client";

import { useEffect, useState } from "react";
import Difficulty from "./difficulty/difficulty";
import Spinner from "@/components/ui/Spinner/Spinner";
import Doty from "@/components/ui/doty/doty";
import { getLevelsService } from "@/services/levels.service";
import { useAuth } from "@/context/auth-context";
import type { Difficulty as DifficultyType } from "@/types/levels.types";

export default function LevelContainer() {
  const { isBootstrapping, accessToken } = useAuth();
  const [levels, setLevels] = useState<DifficultyType[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (isBootstrapping) return;
    if (!accessToken) {
      // Refresh failed — no session. Send the user to login.
      window.location.replace("/");
      return;
    }
    let mounted = true;
    getLevelsService()
      .then((data) => {
        if (!mounted) return;
        setLevels(Array.isArray(data) ? data : (data?.levels ?? []));
      })
      .catch((err) => {
        console.error("LevelContainer: failed to fetch levels:", err);
        if (mounted) setError(true);
      });
    return () => {
      mounted = false;
    };
  }, [isBootstrapping, accessToken]);

  if (error) {
    return (
      <div className="flex w-full flex-col items-center gap-4 px-4 py-16 text-center">
        <Doty pose="05" size="small" />
        <h2 className="text-2xl font-extrabold text-foreground">
          Oops! We couldn&apos;t load your levels
        </h2>
        <p className="text-sm text-(--muted)">
          Please check your connection and try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-2xl bg-(--accent) px-6 py-3 text-sm font-extrabold text-white shadow-md transition-transform hover:-translate-y-0.5 active:scale-95"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!levels) {
    return (
      <div className="flex w-full items-center justify-center py-24">
        <Spinner title="Loading levels..." />
      </div>
    );
  }

  return (
    <div className="w-full px-4">
      <div className="flex flex-col gap-6">
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
