import { Suspense } from "react";
import Difficulty from "./difficulty/difficulty";
import Spinner from "@/components/ui/Spinner/Spinner";
import { getLevelsServer } from "@/services/levels.server";

type Level = {
  id: number;
  img: string;
  enabled: number;
  name: string;
  sections?: { id: number; name: string }[];
};

export default async function LevelContainer() {
  // Server-side fetch that forwards cookies using the helper
  const levels: Level[] = await getLevelsServer();
  console.log("Fetched levels:", JSON.stringify(levels[0], null, 2));
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
            />
          ))}
        </div>
      </Suspense>
    </div>
  );
}
