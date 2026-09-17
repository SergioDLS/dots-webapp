"use client";

import { useSyncExternalStore } from "react";
import { readStoredUser, type StoredUser } from "@/lib/current-user";

const emptySubscribe = () => () => {};

// Misma referencia siempre: si el snapshot del servidor devolviera un
// objeto nuevo en cada llamada, useSyncExternalStore lo vería como un
// cambio infinito. Ver lib/doty-pose-aleatoria.ts para el mismo problema.
const SERVER_SNAPSHOT: StoredUser = Object.freeze({});

// Cacheado a nivel de módulo, igual que lib/doty-pose-aleatoria.ts cachea su
// sorteo: se calcula una sola vez por carga de página y no cambia mientras
// viva. Seguro porque ninguna pantalla que use este hook existe antes de
// haber iniciado sesión (login escribe localStorage.user de forma síncrona
// antes de navegar a ellas) y porque logout y la expiración de sesión
// recargan la página por completo (CLAUDE.md regla 1), lo que reinicia este
// módulo — no hace falta invalidar el valor a mitad de sesión.
let cachedClientUser: StoredUser | null = null;

function clientSnapshot(): StoredUser {
  if (cachedClientUser === null) {
    cachedClientUser = readStoredUser();
  }
  return cachedClientUser;
}

function serverSnapshot(): StoredUser {
  return SERVER_SNAPSHOT;
}

/**
 * Dos pasos seguros para hidratación (mismo patrón que
 * app/(app)/admin/layout.tsx y components/interactive-column/top-students.tsx):
 * en el servidor y en el primer render del cliente devuelve `{}`, así que no
 * hay mismatch posible. Tras hidratar, devuelve el usuario real leído de
 * localStorage y cacheado para el resto de la carga de página.
 */
export function useStoredUser(): StoredUser {
  return useSyncExternalStore(emptySubscribe, clientSnapshot, serverSnapshot);
}
