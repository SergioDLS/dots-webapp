"use client";

import React, { useSyncExternalStore } from "react";
import Image from "next/image";
import Doty, { type DotyAnimation } from "./doty";
import { conocidoCliente, conocidoServidor, suscribir } from "@/lib/doty-transformacion";

/**
 * Doty en las pantallas previas a la sesión (login, /forgot, /invite): el nuevo
 * solo a quien ya lo conoce; a todos los demás, el clásico. El rediseño es una
 * sorpresa que se revela dentro de la app, y una pantalla de paso no puede
 * estropearla (ver "¿Ya conoce al Doty nuevo?" en lib/doty-transformacion.ts).
 *
 * El clásico va con `next/image` y no con `<Doty>` a propósito, igual que el del
 * login: no es una pose del registro ni debe serlo. Vive en
 * public/images/doty-classic/, que check-doty-assets --strict no recorre.
 *
 * Solo acepta las poses que tienen un clásico equivalente. La tabla sale del
 * README de esa carpeta — a qué pieza del registro servía de fallback cada
 * sprite — y, donde el README no dice nada, del gesto más parecido.
 */
const CLASICO = {
  senalando: 13,
  pensando: 7,
  preocupado: 7,
  triste: 5,
  "oh-no": 5,
  "muy-feliz": 2,
  excelente: 4,
  "lo-lograste": 4,
} as const;

export type DotyPreSesionPose = keyof typeof CLASICO;

type Tamano = "micro" | "tiny" | "smaller";

/** Mismos anchos que `<Doty>`, para que cambiar uno por otro no mueva nada. */
const SIZE: Record<Tamano, { px: number; cls: string }> = {
  micro: { px: 32, cls: "w-8" },
  tiny: { px: 96, cls: "w-24" },
  smaller: { px: 112, cls: "w-28" },
};

const ANIM: Record<DotyAnimation, string> = {
  none: "",
  bob: "doty-bob",
  cheer: "doty-cheer",
  sad: "doty-sad",
  wave: "doty-wave",
};

export default function DotyPreSesion({
  pose,
  size = "smaller",
  animation = "none",
  siempreClasico = false,
}: {
  pose: DotyPreSesionPose;
  size?: Tamano;
  animation?: DotyAnimation;
  /** Para /invite: quien acepta una invitación es nuevo por definición. */
  siempreClasico?: boolean;
}) {
  // Snapshot cacheado y `false` en el servidor: el primer pintado siempre es el
  // clásico, y solo quien ya lo conoce pasa al nuevo al hidratar.
  const conoce = useSyncExternalStore(suscribir, conocidoCliente, conocidoServidor);
  if (conoce && !siempreClasico) {
    return <Doty pose={pose} size={size} animation={animation} />;
  }
  const { px, cls } = SIZE[size];
  const n = String(CLASICO[pose]).padStart(2, "0");
  return (
    // Sin `doty-shadow`: los clásicos traen la elipse pintada dentro del PNG.
    <Image
      src={`/images/doty-classic/classic-${n}.png`}
      alt=""
      aria-hidden
      width={300}
      height={300}
      sizes={`${px}px`}
      className={`h-auto select-none ${cls} ${ANIM[animation]}`}
      priority
      draggable={false}
    />
  );
}
