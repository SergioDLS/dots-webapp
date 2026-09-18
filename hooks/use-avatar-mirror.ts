"use client";

import { useSyncExternalStore } from "react";
import { readAvatarMirror } from "@/lib/avatar-mirror";
import type { PublicAvatar } from "@/lib/avatar";

const emptySubscribe = () => () => {};

// Misma referencia siempre, igual que en hooks/use-stored-user.ts: un snapshot
// que devolviera objeto nuevo en cada llamada seria un cambio infinito para
// useSyncExternalStore.
const SERVER_SNAPSHOT: PublicAvatar | null = null;

// Cacheado a nivel de modulo por la misma razon que el usuario guardado: se
// lee una vez por carga de pagina. Aqui ademas da igual que envejezca — solo
// alimenta el primer pintado, y en cuanto responde /me/settings la pagina pasa
// a mandar con su propio estado.
let cached: PublicAvatar | null | undefined;

function clientSnapshot(): PublicAvatar | null {
  if (cached === undefined) {
    cached = readAvatarMirror();
  }
  return cached;
}

function serverSnapshot(): PublicAvatar | null {
  return SERVER_SNAPSHOT;
}

/**
 * El avatar espejado en este dispositivo, o null si no hay ninguno.
 *
 * Dos pasos seguros para hidratacion: en el servidor y en el primer render del
 * cliente devuelve null, asi que el HTML servido y el primer pintado coinciden
 * y no hay mismatch. Tras hidratar entrega el espejo, que llega mucho antes que
 * `/me/settings` — es justo el hueco en el que se veia el clasico ajeno.
 *
 * No es la fuente de verdad: quien lo use debe preferir siempre el valor que
 * llegue del servidor en cuanto lo tenga.
 */
export function useAvatarMirror(): PublicAvatar | null {
  return useSyncExternalStore(emptySubscribe, clientSnapshot, serverSnapshot);
}
