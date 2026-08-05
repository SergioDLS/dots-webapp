"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getAdminCharacters,
  type AdminCharacter,
} from "@/services/admin.service";

export interface AdminCharactersState {
  /**
   * Elenco de narradores, o `null` mientras carga / si la carga falló.
   *
   * A propósito NO cae a `[]`: el studio siembra su selector de narrador con el
   * `characterId` del ítem, así que con un elenco vacío mostraría un `<select>`
   * cuya única opción es "Auto (balanceado)" mientras el valor real es otro. El
   * control mentiría sobre el narrador y el primer toque lo reasignaría. Con
   * `null` el consumidor distingue "todavía no sé" de "elenco vacío" y puede
   * negarse a montar el studio.
   */
  characters: AdminCharacter[] | null;
  /** La carga falló. `characters` sigue en `null`. */
  error: boolean;
  /** Reintenta la carga (patrón `fetchAttempt`: no fetchea, bumpea el intento). */
  retry: () => void;
  /**
   * Nombre del narrador para la UI. `"—"` si no hay narrador; `"#42"` si el id
   * no está en el elenco (cargando, o personaje borrado): son dos cosas
   * distintas y la tabla las tiene que poder diferenciar.
   */
  characterName: (id?: number | null) => string;
}

/**
 * Carga el elenco de narradores del admin, una vez por pantalla.
 *
 * Lo comparten los cuatro managers de fundamentos y el modal de oraciones: es
 * el mismo fetch, el mismo helper de nombres y el mismo requisito de no montar
 * el studio de voz sin elenco.
 */
export function useAdminCharacters(): AdminCharactersState {
  const [characters, setCharacters] = useState<AdminCharacter[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    getAdminCharacters()
      .then((rows) => {
        if (alive) setCharacters(rows);
      })
      .catch(() => {
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setError(false);
    setAttempt((n) => n + 1);
  }, []);

  const characterName = useCallback(
    (id?: number | null) =>
      characters?.find((c) => c.id === id)?.name ??
      (id != null ? `#${id}` : "—"),
    [characters],
  );

  return { characters, error, retry, characterName };
}
