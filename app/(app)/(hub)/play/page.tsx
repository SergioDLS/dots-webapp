import GamesList from "@/components/interactive-column/games-list";

export default function PlayPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-extrabold text-foreground">
          Zona de juego
        </h1>
        <p className="text-sm font-semibold text-(--muted)">
          Juega para practicar sin darte cuenta. Las lecturas ahora aparecen en
          tu camino, entre los niveles.
        </p>
      </header>

      <section className="overflow-hidden rounded-2xl border border-(--border) bg-(--surface)">
        <GamesList />
      </section>
    </div>
  );
}
