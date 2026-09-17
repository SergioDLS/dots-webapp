"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/context/auth-context";
import {
  escribirEspejo,
  estaOnboardado,
  fijarPrimerInicio,
  leerEspejo,
} from "@/lib/first-run";
import { getMySettingsService } from "@/services/settings.service";

/**
 * Primer inicio guiado (spec §7.1): manda a `/welcome` a quien todavía no tiene
 * `onboarded_at`.
 *
 * NO envuelve a nadie ni bloquea el render: pinta `null` y decide en un efecto.
 * Envolver habría puesto una espera a `GET /me/settings` delante de cada
 * página del hub —o un parpadeo en cada carga, porque el espejo no se puede
 * leer en el render del servidor sin romper la hidratación— a cambio de nada:
 * quien no está onboardado se va igual, y quien sí lo está no debe esperar.
 *
 * El espejo `dots-onboarded` es solo un atajo para ahorrarse el fetch; la
 * verdad vive en el servidor, igual que con paleta, modo y sonido.
 */
export default function FirstRunGate() {
  const router = useRouter();
  const { isBootstrapping, accessToken } = useAuth();

  useEffect(() => {
    // Sin sesión resuelta no hay a quién preguntar. Ojo: `lib/api-client.ts`
    // solo expulsa al login con un 403 (cuenta bloqueada o expirada); un
    // refresh que falla por cookie vencida deja `accessToken` en null sin
    // redirigir, y este `return` es lo que evita preguntar en ese estado.
    if (isBootstrapping || !accessToken) return;

    if (leerEspejo()) {
      fijarPrimerInicio("hecho");
      return;
    }

    // Sin espejo todavía no sabemos, pero SÍ sabemos que hay que averiguarlo:
    // publicarlo ya es lo que impide que el Camino redirija a placement en la
    // ventana en la que `GET /path` responde antes que `GET /me/settings`.
    // Este `fijarPrimerInicio` corre síncrono al montar; la redirección del
    // Camino solo puede ocurrir tras una respuesta de red, así que siempre
    // llega después.
    fijarPrimerInicio("pendiente");

    let activo = true;
    getMySettingsService().then((settings) => {
      if (!activo) return;
      if (estaOnboardado(settings)) {
        // También cuando `settings` es null (fetch fallido): fallar abierto.
        if (settings) escribirEspejo();
        fijarPrimerInicio("hecho");
        return;
      }
      fijarPrimerInicio("pendiente");
      router.replace("/welcome");
    });

    return () => {
      activo = false;
    };
  }, [isBootstrapping, accessToken, router]);

  return null;
}
