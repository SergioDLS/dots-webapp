import Doty from "@/components/ui/doty/doty";

export default function QuestsPage() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <Doty pose="10" size="small" />
      <h1 className="font-display text-2xl font-extrabold text-foreground">
        Retos
      </h1>
      <p className="max-w-sm text-sm font-semibold text-(--muted)">
        Tu misión del día y la tabla de posiciones.
      </p>
    </div>
  );
}
