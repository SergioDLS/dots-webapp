"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

import DotyClip from "@/components/ui/doty/doty-clip";
import OverlayPortal from "@/components/ui/overlay-portal";
import {
  entradaCliente,
  entradaServidor,
  suscribir,
  SALUDO_MS,
  SALUDO_SRC,
  TRANSFORMACION_MS,
  TRANSFORMACION_SRC,
} from "@/lib/doty-transformacion";

/**
 * La animación de entrada a la app, como overlay sobre la pantalla ya montada.
 *
 * Va aquí y no en el login porque así el tiempo de la animación SE SOLAPA con el
 * fetch del Camino en vez de sumarse: el coste pasa de `animación + carga` a
 * `max(animación, carga)`. Si el fetch acaba antes, el contenido ya está detrás
 * cuando esto se desvanece; si tarda más, al desvanecerse queda el spinner
 * normal. Los dos relojes son independientes a propósito.
 *
 * Qué reproducir lo decide el login y lo deja en `sessionStorage`: es la única
 * puerta de entrada y lo único capaz de distinguir un login con formulario de
 * una sesión rehidratada. Aquí solo se reproduce.
 *
 * Se monta en el layout del hub, que se monta una vez por carga de página y
 * sobrevive al cambio de pestañas. En `/levels` reaparecería cada vez que
 * alguien volviera al Camino desde Juegos.
 */
export default function DotyEntrada() {
  const entrada = useSyncExternalStore(suscribir, entradaCliente, entradaServidor);
  const [fase, setFase] = useState<"inicial" | "saludo" | "fin">("inicial");

  const alTerminarTransformacion = useCallback(() => setFase("saludo"), []);
  const alTerminarSaludo = useCallback(() => setFase("fin"), []);

  if (!entrada || fase === "fin") return null;

  const mostrarTransformacion = entrada === "transformacion" && fase === "inicial";

  return (
    <OverlayPortal>
      <div
        // `fixed` e `inset-0`: cubre la pantalla entera sin desplazar nada de lo
        // que hay debajo, que sigue montándose y cargando con normalidad.
        className="fixed inset-0 z-50 flex items-center justify-center bg-(--background)"
        // Lo mira el controlador de pistas: mientras este overlay exista está
        // tapando la pantalla entera, así que medir un elemento debajo daría un
        // rectángulo que el usuario no puede ver.
        data-doty-entrada
        style={{ animation: "dots-entrada-transformacion 320ms ease-out both" }}
        aria-hidden
      >
        {mostrarTransformacion ? (
          <DotyClip
            src={TRANSFORMACION_SRC}
            ms={TRANSFORMACION_MS}
            onEnd={alTerminarTransformacion}
          />
        ) : (
          <DotyClip src={SALUDO_SRC} ms={SALUDO_MS} onEnd={alTerminarSaludo} />
        )}
      </div>
    </OverlayPortal>
  );
}
