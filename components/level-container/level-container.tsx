import { Suspense } from "react";
import Link from "next/link";
import Difficulty from "./difficulty/difficulty";
import Spinner from "@/components/ui/Spinner/Spinner";
import { getLevelsServer } from "@/services/levels.server";

type Level = {
  id: number;
  img: string;
  enabled: number;
  name: string;
  sections?: { id: number; name: string }[];
  progress: number;
};

export default async function LevelContainer() {
  // Server-side fetch that forwards cookies using the helper
  let levels: Level[] = [];
  try {
    levels = await getLevelsServer();
    console.log("Fetched levels:", JSON.stringify(levels[0], null, 2));
  } catch (err) {
    // If the server-side fetch fails (for example missing cookies or
    // invalid session) return a friendly message instead of throwing a
    // raw error that crashes Server Components rendering.
    console.error("LevelContainer: failed to fetch levels:", err);
    return (
      <div className="w-full px-4 py-8">
        <h2 className="text-2xl font-bold">Could not load levels</h2>
        <p className="text-sm text-(--muted)">There was a problem loading your levels. Please ensure you are logged in and try again.</p>
        <div className="mt-4">
          <Link href="/" className="text-sm underline">Go to login</Link>
        </div>
      </div>
    );
  }
  return (
  <div className={`w-full md:ml-80 md:w-[calc(100%-20rem-2rem)] md:pr-4 px-4 min-h-screen`}>
      <Suspense fallback={<Spinner title="Loading levels..." />}>
        <div className="flex flex-col gap-6">
          {levels.map((item: Level) => (
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
