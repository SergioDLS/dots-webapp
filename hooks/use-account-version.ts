"use client";

import { useSyncExternalStore } from "react";

import { suscribirCuenta, versionCuenta } from "@/lib/account-refresh";

const servidor = () => 0;

/**
 * Sube cada vez que una acción de la caja de admin cambia la cuenta. Ponlo en
 * las dependencias del efecto de carga y ese efecto vuelve a pedir.
 */
export function useAccountVersion(): number {
  return useSyncExternalStore(suscribirCuenta, versionCuenta, servidor);
}
