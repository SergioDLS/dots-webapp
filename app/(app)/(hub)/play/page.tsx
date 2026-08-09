import Doty from "@/components/ui/doty/doty";
import GamesGrid from "@/components/play/games-grid";

export default function PlayPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-extrabold text-foreground">
            Zona de juego
          </h1>
          <p className="text-sm font-semibold text-(--muted)">
            Practica jugando. Las lecturas viven en tu camino.
          </p>
        </div>
        <Doty pose="12" size="mini" customClass="hidden shrink-0 sm:block" />
      </header>

      <GamesGrid />
    </div>
  );
}
