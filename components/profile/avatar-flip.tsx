"use client";

import { useEffect, useState } from "react";

import Avatar, { AvatarShadow } from "@/components/ui/avatar/avatar";
import Doty, { type DotyAnimation } from "@/components/ui/doty/doty";
import { avatarOrDefault, type PublicAvatar } from "@/lib/avatar";
import { FLIP_MS, flourishTimeline, gesturePose, shouldFlourish } from "@/lib/avatar-flip";

/**
 * El avatar del perfil como carta de dos caras (spec §6.4): el retrato al
 * frente y, detrás, Doty haciendo el gesto equipado, bajo la misma sombra.
 *
 * - Giro de entrada: cuando ya hay datos (`ready`) y hay gesto, el retrato se
 *   ve un momento, la carta gira, el gesto da vueltas completas y vuelve. Una
 *   vez por montaje: la identidad remonta la carta con `key` al cambiar de
 *   gesto, y eso la vuelve a reproducir como confirmación de equipar.
 * - Tap: alterna el dorso fijo. Hover: solo con ratón (`pointerType`), para
 *   que un tap no cuente dos veces. El tap es la señal primaria (regla 2).
 * - Sin gesto no hay botón ni dorso: el avatar no gira nunca.
 * - Con `prefers-reduced-motion` no hay giro de entrada; el CSS global ya
 *   deja el giro instantáneo y a Doty quieto, así que el tap sigue sirviendo.
 *
 * Mismo patrón 3D que las cartas del juego de memoria: `perspective` en el
 * contenedor, `preserve-3d` en la carta y `backface-visibility: hidden` en
 * cada cara. Solo `transform` (principio 5 de la spec).
 */
interface Props {
  avatar: PublicAvatar | null;
  /** Animación del gesto equipado, o null si no hay ninguno. */
  gesture: DotyAnimation | null;
  /** Diámetro en px: 78 en móvil, 96 en escritorio. */
  size: number;
  /** true cuando /me/settings y el inventario ya respondieron: el giro de entrada espera a los dos. */
  ready: boolean;
}

/** Igual que en lib/doty-transformacion.ts: se lee en un efecto, nunca en el render. */
function prefiereMenosMovimiento(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export default function AvatarFlip({ avatar, gesture, size, ready }: Props) {
  const [flourishing, setFlourishing] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [hovering, setHovering] = useState(false);

  // Solo programa temporizadores; el estado lo cambian sus callbacks (regla 3).
  useEffect(() => {
    if (!ready) return;
    const timeline = flourishTimeline(gesture);
    if (!timeline || !shouldFlourish(gesture, prefiereMenosMovimiento())) return;
    const ida = setTimeout(() => setFlourishing(true), timeline.flipAt);
    const vuelta = setTimeout(() => setFlourishing(false), timeline.flipBackAt);
    return () => {
      clearTimeout(ida);
      clearTimeout(vuelta);
    };
  }, [ready, gesture]);

  const a = avatarOrDefault(avatar);
  const hayGesto = gesture !== null;
  const dorso = hayGesto && (flourishing || pinned || hovering);

  const carta = (
    <span className="relative inline-block" style={{ width: size, height: size, perspective: "600px" }}>
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          transformStyle: "preserve-3d",
          transform: dorso ? "rotateY(180deg)" : "rotateY(0deg)",
          transition: `transform ${FLIP_MS}ms var(--ease-in-out-strong)`,
        }}
      >
        <span
          className="absolute inset-0"
          style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
        >
          <Avatar avatar={a} size={size} />
        </span>
        {gesture !== null && (
          <span
            className="absolute inset-0"
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            {/* Doty al 70 % del lado, con la sombra teñida del avatar y sin la suya propia. */}
            <AvatarShadow color={a.color} size={size}>
              <Doty pose={gesturePose(gesture)} size="dorso" animation={gesture} shadow={false} />
            </AvatarShadow>
          </span>
        )}
      </span>
    </span>
  );

  if (!hayGesto) return carta;

  return (
    <button
      type="button"
      onClick={() => setPinned((p) => !p)}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") setHovering(true);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") setHovering(false);
      }}
      aria-pressed={pinned}
      aria-label="Ver el gesto de tu Doty"
      className="inline-flex cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
    >
      {carta}
    </button>
  );
}
