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

  return (
    <div className={`w-full md:w-2/3`}>
      <Suspense fallback={<Spinner title="Loading levels..." />}>
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
      </Suspense>
    </div>
  );
}
