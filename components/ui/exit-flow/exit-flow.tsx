"use client";

import { useEffect, useState } from "react";

import UIButton from "@/components/ui/button/button";
import Doty from "@/components/ui/doty/doty";
import type { DotyPose } from "@/components/ui/doty/doty";
import OverlayPortal from "@/components/ui/overlay-portal";
import { bloquearScroll } from "@/lib/scroll-lock";

/**
 * La salida de un flujo inmersivo (lección, práctica, checkpoint, lectura), con
 * su aviso de confirmación. Botón y aviso viven juntos a propósito: el aviso no
 * se puede olvidar en una pantalla si no hay forma de poner el botón sin él.
 *
 * Existe porque cada flujo se había inventado el suyo — texto pelado a 14 px en
 * `numbers` y en las lecturas, `tone="neutral"` en vocabulario y pronunciación,
 * `tone="ghost"` en letras — y dos de ellos en inglés ("Back to levels",
 * "Exit"), contra la regla de UI en español.
 *
 * Es un botón y no texto pelado porque en móvil la salida se toca con el pulgar:
 * 14 px de texto quedan por debajo del área táctil que recomienda la WCAG 2.5.8,
 * la misma razón por la que el lápiz del perfil lleva sus 40 px. Y ahora que
 * confirma, un toque de más ya no cuesta la sesión.
 */

/** Poses que combinan con "¿seguro?": incrédula, preocupada y "vuelve aquí".
 *
 *  Ninguna es triste: el aviso pregunta, no da pena. `triste` o `llanto-dramatico`
 *  convertirían un "no, sigo" en chantaje.
 */
const POSES: readonly DotyPose[] = ["reojo", "preocupado", "ven-aqui"];

/** Se sortea al ABRIR, nunca durante el render.
 *
 *  En el render rompería la hidratación (servidor y cliente sortearían distinto)
 *  y ademas cambiaría de pose en cada repintado. Aquí no hay riesgo: el aviso no
 *  existe en el HTML servido, solo aparece tras un toque. Y al sortear en cada
 *  apertura, quien salga dos veces ve dos Dotys distintos.
 */
function sortearPose(): DotyPose {
  return POSES[Math.floor(Math.random() * POSES.length)];
}

interface Props {
  /** Qué hacer al confirmar. Normalmente `router.push("/levels")` (regla 1). */
  onExit: () => void;
  /**
   * Qué se pierde, en una frase. Se pinta bajo la pregunta.
   *
   * `null` significa que no hay nada que perder — la portada de una lección,
   * una pantalla de error — y entonces sale directo, sin preguntar. Es
   * obligatorio y sin valor por defecto para que cada pantalla lo decida a
   * conciencia: un aviso genérico no avisa de nada, y preguntar donde no hay
   * riesgo enseña a decir que sí sin leer.
   */
  aviso: string | null;
  /** Texto del botón. Por defecto "Salir"; el checkpoint dice "Volver". */
  label?: string;
  /**
   * Para las barras superiores estrechas — la de los juegos en partida y la de
   * las lecturas — donde el botón normal (14 px de aire vertical) no cabe en un
   * `dots-card` de 12. Se aprieta por `style` y no por clases: Tailwind resuelve
   * los conflictos por el orden del CSS generado, no por el de la lista, asi que
   * un `px-3` añadido no le gana seguro a su `px-5`.
   */
  compacto?: boolean;
}

const APRETADO = { paddingInline: 12, paddingBlock: 8, fontSize: "0.8125rem" };

export default function ExitFlow({ onExit, aviso, label = "Salir", compacto = false }: Props) {
  const [pose, setPose] = useState<DotyPose | null>(null);
  const abierto = pose !== null;

  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPose(null);
    };
    document.addEventListener("keydown", onKey);
    const soltar = bloquearScroll();
    return () => {
      document.removeEventListener("keydown", onKey);
      soltar();
    };
  }, [abierto]);

  return (
    <>
      <UIButton
        tone="neutral"
        onClick={() => (aviso === null ? onExit() : setPose(sortearPose()))}
        style={compacto ? APRETADO : undefined}
      >
        ← {label}
      </UIButton>

      {abierto && (
        <OverlayPortal>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label="Confirmar salida"
            className="fixed inset-0 z-50 flex items-center justify-center px-5"
          >
            <div
              aria-hidden
              onClick={() => setPose(null)}
              className="absolute inset-0"
              style={{ background: "var(--scrim)" }}
            />
            <div className="dots-card relative z-10 flex w-full max-w-sm flex-col items-center gap-3 p-6 text-center [animation:dots-pop-in_.25s_ease-out_both]">
              <Doty pose={pose} size="small" />
              <h2 className="font-display text-xl font-extrabold text-foreground">
                ¿Seguro que quieres salir?
              </h2>
              <p className="text-sm font-semibold text-(--muted)">{aviso}</p>
              {/* Seguir primero y en acento: el camino que no destruye nada es
                  el que debe quedar bajo el pulgar y pesar más a la vista. */}
              <div className="mt-2 flex w-full flex-col gap-2">
                <UIButton tone="accent" onClick={() => setPose(null)} fullWidth>
                  Sigo aquí
                </UIButton>
                <UIButton tone="ghost" onClick={onExit} fullWidth>
                  Salir de todos modos
                </UIButton>
              </div>
            </div>
          </div>
        </OverlayPortal>
      )}
    </>
  );
}
