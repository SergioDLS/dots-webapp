import Doty from "@/components/ui/doty/doty";

export default function ReviewPage() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <Doty pose="03" size="small" />
      <h1 className="font-display text-2xl font-extrabold text-foreground">
        Repaso
      </h1>
      <p className="max-w-sm text-sm font-semibold text-(--muted)">
        Aquí volverás a practicar lo que fallas, justo cuando estás por
        olvidarlo. Muy pronto.
      </p>
    </div>
  );
}
