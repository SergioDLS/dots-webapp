"use client";

import { useEffect, useSyncExternalStore } from "react";

import { ADMIN_PROFILE } from "@/constants";
import { useStoredUser } from "@/hooks/use-stored-user";
import {
  estadoModoAdmin,
  fijarModoAdmin,
  modoAdminDesdeAjustes,
  suscribirModoAdmin,
  type EstadoModoAdmin,
} from "@/lib/admin-mode";
import { getMySettingsService } from "@/services/settings.service";

// Single-flight: la pastilla del HUD y el switch de Ajustes pueden montarse a
// la vez; una sola petición a /me/settings las sirve a las dos.
let consulta: Promise<void> | null = null;

function averiguar(): Promise<void> {
  if (!consulta) {
    consulta = getMySettingsService()
      .then((settings) => {
        fijarModoAdmin(modoAdminDesdeAjustes(settings));
      })
      .finally(() => {
        consulta = null;
      });
  }
  return consulta;
}

const servidor = (): EstadoModoAdmin => "desconocido";

/**
 * Estado del modo admin para esta cuenta. Un alumno no paga la petición: sin
 * perfil de admin no se pregunta nada y `encendido` es siempre false. El
 * fetch va en un efecto (no hay setState síncrono: el store avisa cuando
 * responde el servidor).
 */
export function useAdminMode(): {
  esAdmin: boolean;
  estado: EstadoModoAdmin;
  encendido: boolean;
} {
  const user = useStoredUser();
  const esAdmin = user.profile === ADMIN_PROFILE;
  const estado = useSyncExternalStore(suscribirModoAdmin, estadoModoAdmin, servidor);

  useEffect(() => {
    if (!esAdmin || estado !== "desconocido") return;
    void averiguar();
  }, [esAdmin, estado]);

  return { esAdmin, estado, encendido: esAdmin && estado === "encendido" };
}
