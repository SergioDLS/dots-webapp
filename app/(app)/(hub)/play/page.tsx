import GamesList from "@/components/interactive-column/games-list";
import ReadingsList from "@/components/interactive-column/readings-list";

export default function PlayPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-extrabold text-foreground">
          Zona de juego
        </h1>
        <p className="text-sm font-semibold text-(--muted)">
          Juega y lee para practicar sin darte cuenta.
        </p>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-(--border) bg-(--surface)">
          <GamesList />
        </section>
        <section className="overflow-hidden rounded-2xl border border-(--border) bg-(--surface)">
          <ReadingsList />
        </section>
      </div>
    </div>
  );
}
