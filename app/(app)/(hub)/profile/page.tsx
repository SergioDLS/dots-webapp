import Doty from "@/components/ui/doty/doty";

export default function ProfilePage() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <Doty pose="06" size="small" />
      <h1 className="font-display text-2xl font-extrabold text-foreground">
        Perfil
      </h1>
      <p className="max-w-sm text-sm font-semibold text-(--muted)">
        Tu progreso, tus logros y tu Doty.
      </p>
    </div>
  );
}
