import { Suspense } from "react";
import Link from "next/link";
import Difficulty from "./difficulty/difficulty";
import Spinner from "@/components/ui/Spinner/Spinner";
import Doty from "@/components/ui/doty/doty";
import { getLevelsServer } from "@/services/levels.server";
import type { Difficulty as DifficultyType } from "@/types/levels.types";

export default async function LevelContainer() {
  // Server-side fetch that forwards cookies using the helper
  let levels: DifficultyType[] = [];
  try {
    levels = await getLevelsServer();
  } catch {
    // If the server-side fetch fails (missing cookies, expired session,
    // backend down) show a friendly recovery card instead of crashing
    // Server Components rendering.
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
          className="dots-pressable rounded-2xl bg-(--accent) px-6 py-3 text-sm font-extrabold text-(--accent-contrast) [--press-color:#9c005d]"
        >
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full">
      <Suspense fallback={<Spinner title="Loading levels..." />}>
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
      </Suspense>
    </div>
  );
}
