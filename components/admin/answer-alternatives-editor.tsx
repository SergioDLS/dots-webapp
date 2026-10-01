"use client";

import { useEffect, useState } from "react";

import { modalInputCls } from "@/components/admin/ui";
import { Icon } from "@/components/ui/icon";
import { cubreTodasLasIncorrectas } from "@/lib/accepted-answers";
import { mensajeDelServidor } from "@/lib/admin-reports";
import {
  createAnswerAlternative,
  deleteAnswerAlternative,
  getAnswerAlternatives,
  type AdminAnswerAlternative,
} from "@/services/admin.service";

type Tipo = AdminAnswerAlternative["kind"];

const TITULO: Record<Tipo, string> = {
  word: "Otras palabras que valen",
  sentence: "Otros órdenes que valen",
};
const AYUDA: Record<Tipo, string> = {
  word: "No salen como opción incorrecta de este ejercicio.",
  sentence: "«Arma la oración» y el Constructor los aceptan.",
};
const EJEMPLO: Record<Tipo, string> = {
  word: "feel",
  sentence: "Today I am happy",
};

/** La API acepta de 1 a 300 caracteres. */
const MAX_LARGO = 300;

const botonChico =
  "shrink-0 rounded-lg border-2 border-(--border) px-3 text-xs font-bold text-(--muted) transition-colors enabled:hover:border-(--accent) enabled:hover:text-(--accent) disabled:opacity-50";

/**
 * Respuestas aceptadas de un ejercicio (spec 2026-10-01 §2.6). Guarda al
 * momento contra /admin/answer-alternatives, sin pasar por «Guardar» del modal.
 *
 * Cada tipo va en su propio bloque y NO dentro de un `<Field>`: `Field` es un
 * `<label>`, y un clic en el texto de un label con varios controles dentro
 * activa el primero (aquí, el «quitar» de la primera respuesta).
 */
export default function AnswerAlternativesEditor({
  targetType,
  targetId,
  kinds,
  distractors,
}: {
  targetType: "sentence" | "grammar_item";
  targetId: number;
  kinds: ReadonlyArray<Tipo>;
  /**
   * Opciones incorrectas guardadas del ejercicio (la gramática las tiene). Si
   * las palabras aceptadas se las llevan todas, el editor avisa: el ejercicio
   * se queda con una sola opción. Avisa, no bloquea.
   */
  distractors?: readonly string[];
}) {
  // null = todavía cargando (o falló: ver `loadError`).
  const [lista, setLista] = useState<AdminAnswerAlternative[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fetchAttempt, setFetchAttempt] = useState(0);
  const [borradores, setBorradores] = useState<Partial<Record<Tipo, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [nota, setNota] = useState<string | null>(null);
  // Una petición a la vez: dos clics seguidos en «Quitar» harían que la segunda
  // contestara «ya no estaba» por la primera.
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    getAnswerAlternatives(targetType, targetId)
      .then((l) => {
        if (vivo) setLista(l);
      })
      .catch((e: unknown) => {
        if (vivo) setLoadError(mensajeDelServidor(e, "No se pudieron cargar las respuestas aceptadas."));
      });
    return () => {
      vivo = false;
    };
  }, [targetType, targetId, fetchAttempt]);

  // Recargar por evento (patrón fetchAttempt, regla 3): el botón resetea y bumpea.
  const reintentar = () => {
    setLoadError(null);
    setFetchAttempt((n) => n + 1);
  };

  const anadir = (kind: Tipo) => {
    const enviado = borradores[kind] ?? "";
    const value = enviado.trim();
    if (!value || ocupado) return;
    setError(null);
    setNota(null);
    setOcupado(true);
    createAnswerAlternative({ targetType, targetId: String(targetId), kind, value })
      .then((nueva) => {
        // Idempotente: si ya valía, el servidor devuelve la que había (mismo id).
        setLista((l) => {
          const actual = l ?? [];
          return actual.some((a) => a.id === nueva.id)
            ? actual.map((a) => (a.id === nueva.id ? nueva : a))
            : [...actual, nueva];
        });
        // Se vacía solo si sigue siendo lo que se mandó: lo que el admin haya
        // seguido escribiendo mientras tanto no se pierde.
        setBorradores((b) => (b[kind] === enviado ? { ...b, [kind]: "" } : b));
      })
      .catch((e: unknown) => setError(mensajeDelServidor(e, "No se pudo guardar.")))
      .finally(() => setOcupado(false));
  };

  const quitar = (id: number) => {
    if (ocupado) return;
    setError(null);
    setNota(null);
    setOcupado(true);
    deleteAnswerAlternative(id)
      .then(({ deleted }) => {
        setLista((l) => (l ?? []).filter((a) => a.id !== id));
        // `deleted: false` = ya no estaba (otro admin la quitó): se dice, no se finge.
        if (!deleted) setNota("Esa respuesta ya no estaba.");
      })
      .catch((e: unknown) => setError(mensajeDelServidor(e, "No se pudo quitar.")))
      .finally(() => setOcupado(false));
  };

  const palabras = (lista ?? []).filter((a) => a.kind === "word").map((a) => a.value);
  const cubreTodas = distractors !== undefined && cubreTodasLasIncorrectas(distractors, palabras);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border-2 border-dashed border-(--border) p-4">
      {loadError ? (
        <div className="flex flex-wrap items-center gap-3">
          <p role="alert" className="text-xs font-bold text-(--danger)">
            {loadError}
          </p>
          <button
            type="button"
            onClick={reintentar}
            className="rounded-lg border-2 border-(--accent) px-3 py-1.5 text-xs font-bold text-(--accent) transition-colors hover:bg-(--accent)/10"
          >
            Reintentar
          </button>
        </div>
      ) : lista === null ? (
        <p className="text-xs font-semibold text-(--muted)">Cargando las respuestas aceptadas…</p>
      ) : (
        kinds.map((kind) => {
          const propias = lista.filter((a) => a.kind === kind);
          const borrador = borradores[kind] ?? "";
          return (
            <div key={kind} className="flex flex-col gap-2">
              <div className="flex flex-col gap-1">
                <span className="px-1 text-xs font-bold text-(--muted)">{TITULO[kind]}</span>
                <p className="px-1 text-xs font-semibold text-(--muted)">{AYUDA[kind]}</p>
              </div>
              {propias.length === 0 ? (
                <p className="px-1 text-sm font-semibold text-(--muted)">Todavía ninguna.</p>
              ) : (
                <ul aria-label={TITULO[kind]} className="flex flex-wrap gap-2">
                  {propias.map((a) => (
                    <li
                      key={a.id}
                      className="flex max-w-full items-center gap-1 rounded-full bg-(--accent)/15 py-0.5 pl-3 pr-1 text-xs font-bold text-(--accent)"
                    >
                      <span className="min-w-0 break-words">{a.value}</span>
                      <button
                        type="button"
                        onClick={() => quitar(a.id)}
                        disabled={ocupado}
                        aria-label={`Quitar ${a.value}`}
                        className="flex size-6 shrink-0 items-center justify-center rounded-full transition-colors enabled:hover:bg-(--accent)/20 disabled:opacity-50"
                      >
                        <Icon name="cruz" size={12} mono />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <input
                  value={borrador}
                  onChange={(e) => setBorradores((b) => ({ ...b, [kind]: e.target.value }))}
                  placeholder={EJEMPLO[kind]}
                  maxLength={MAX_LARGO}
                  aria-label={TITULO[kind]}
                  className={modalInputCls}
                />
                <button
                  type="button"
                  onClick={() => anadir(kind)}
                  disabled={ocupado || borrador.trim() === ""}
                  className={botonChico}
                >
                  Añadir
                </button>
              </div>
              {kind === "word" && cubreTodas && (
                <p
                  role="status"
                  className="rounded-xl border-2 border-(--flame)/40 bg-(--flame)/10 px-3 py-2 text-xs font-bold text-foreground"
                >
                  Aceptaste todas las opciones incorrectas: el ejercicio se queda con una sola opción.
                </p>
              )}
            </div>
          );
        })
      )}
      {error && (
        <p role="alert" className="text-xs font-bold text-(--danger)">
          {error}
        </p>
      )}
      {nota && (
        <p role="status" className="text-xs font-semibold text-(--muted)">
          {nota}
        </p>
      )}
    </div>
  );
}
