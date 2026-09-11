"use client";

import Image from "next/image";
import { useEffect } from "react";

interface Props {
  src: string;
  /** Duración real del clip. Ver la nota sobre por qué hace falta. */
  ms: number;
  /** Se llama al terminar. El llamador decide qué sigue. */
  onEnd: () => void;
}

/**
 * Reproduce una vez un clip de Doty (WebP animado con alfa) y avisa al acabar.
 *
 * El final se detecta con un temporizador y no con un evento, porque un WebP
 * animado se pinta como una imagen y no emite `ended`: el navegador no expone
 * en qué fotograma va. Por eso `ms` tiene que venir de fuera y coincidir con lo
 * que escribió `scripts/mj/compose-transformacion.py` — las dos cifras se mueven
 * juntas y viven en `lib/doty-transformacion.ts`.
 *
 * `onEnd` es la única salida, así que si algo fuera mal el usuario sale igual.
 */
export default function DotyClip({ src, ms, onEnd }: Props) {
  useEffect(() => {
    const t = setTimeout(onEnd, ms);
    return () => clearTimeout(t);
  }, [onEnd, ms]);

  return (
    <Image
      src={src}
      alt=""
      width={256}
      height={256}
      // `unoptimized` es obligatorio: el optimizador de Next reescribe la imagen
      // y se queda con el primer fotograma, así que la animación no ocurre.
      unoptimized
      priority
      className="h-auto w-28 select-none"
      draggable={false}
    />
  );
}
