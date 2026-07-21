import Doty from "@/components/ui/doty/doty";

export default function PlayPage() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <Doty pose="15" size="small" />
      <h1 className="font-display text-2xl font-extrabold text-foreground">
        Zona de juego
      </h1>
      <p className="max-w-sm text-sm font-semibold text-(--muted)">
        Juegos y lecturas para practicar sin darte cuenta.
      </p>
    </div>
  );
}
