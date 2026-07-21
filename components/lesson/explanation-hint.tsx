"use client";

/**
 * Panel breve que aparece al fallar un ítem: convierte el error en aprendizaje
 * (la regla de gramática, el contraste del par mínimo, etc.). No bloquea el
 * ritmo — se muestra bajo el feedback y el usuario continúa cuando quiere.
 */
export default function ExplanationHint({ hint }: { hint?: string | null }) {
  if (!hint) return null;
  return (
    <div
      className="flex w-full items-start gap-2 rounded-2xl px-4 py-3"
      style={{
        background: "color-mix(in srgb, var(--primary) 8%, var(--surface))",
        border: "1.5px solid color-mix(in srgb, var(--primary) 25%, transparent)",
        animation: "dots-slide-up 0.25s ease-out both",
      }}
    >
      <span className="shrink-0 text-xl leading-none">💡</span>
      <p className="text-sm font-semibold leading-snug text-foreground">{hint}</p>
    </div>
  );
}
