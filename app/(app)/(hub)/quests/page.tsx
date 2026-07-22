"use client";

import { Suspense } from "react";
import DailyQuestCard from "@/components/interactive-column/daily-quest";
import TopStudents from "@/components/interactive-column/top-students";
import TournamentCard from "@/components/quests/tournament-card";
import ChallengesPanel from "@/components/quests/challenges-panel";
import RivalBanner from "@/components/quests/rival-banner";
import { useRivalWatch } from "@/hooks/use-rival-watch";

function QuestsPageInner() {
  useRivalWatch();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-extrabold text-foreground">
          Retos
        </h1>
        <p className="text-sm font-semibold text-(--muted)">
          Completa tu misión del día y sube en la tabla.
        </p>
      </header>

      {/* Rival banner — small motivational hook, shown first */}
      <div className="mx-auto w-full max-w-md">
        <RivalBanner />
      </div>

      <div className="mx-auto w-full max-w-md">
        <Suspense fallback={null}>
          <TournamentCard />
        </Suspense>
      </div>

      <div className="mx-auto w-full max-w-md">
        <ChallengesPanel />
      </div>

      <div className="mx-auto w-full max-w-md">
        <DailyQuestCard />
      </div>

      <section className="overflow-hidden rounded-2xl border border-(--border) bg-(--surface)">
        <TopStudents />
      </section>
    </div>
  );
}

export default function QuestsPage() {
  return (
    <Suspense fallback={null}>
      <QuestsPageInner />
    </Suspense>
  );
}
