"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import RivalAlert from "@/components/rival/rival-alert";
import { useAuth } from "@/context/auth-context";
import { useStoredUser } from "@/hooks/use-stored-user";
import {
  claveSnapshot,
  decidirAviso,
  parsearSnapshot,
  serializarSnapshot,
  type Aviso,
} from "@/lib/rival-alert";
import { hayScrollBloqueado } from "@/lib/scroll-lock";
import { getRivalService } from "@/services/engagement.service";

/**
 * Las tres pantallas donde se avisa. A Repaso, al Perfil y a la Tienda se va
 * con una intención concreta —practicar o gestionar algo— y el aviso la
 * interrumpiría.
 */
const RUTAS = new Set(["/levels", "/play", "/quests"]);

/** Cada cuánto se mira si la pantalla ya se destapó. */
const INTERVALO_MS = 80;

/**
 * Techo de la espera a que se destape. Mismo valor y mismo motivo que el de
 * `hooks/use-tip-anchor.ts`: es el seguro por si algo se queda pegado, no un
 * presupuesto. Pasado ese rato el aviso se descarta sin pintarse — enseñarlo
 * mucho después de entrar a la pantalla ya no es una reacción a nada.
 */
const ESPERA_TAPADO_MS = 20000;

/**
 * Si algo cubre la pantalla, el aviso se gastaría sin que nadie lo viera: dura
 * 6 s y se descarta solo. Los dos tapones son los mismos que espera
 * `hooks/use-tip-anchor.ts`, y por eso se consultan igual que allí:
 *
 * - la animación de entrada de Doty (`[data-doty-entrada]`), un overlay OPACO
 *   en `z-50` que corre en todo login con formulario — justo el camino más
 *   común hacia el primer aviso;
 * - cualquier diálogo que tenga tomado el scroll (`hayScrollBloqueado`), que
 *   hoy es una pista contextual, la hoja de ajustes o el selector de avatar.
 *
 * Una pestaña de fondo cuenta como tapón por lo mismo: el reloj de los 6 s
 * corre igual y el aviso se consumiría a espaldas del usuario.
 */
function pantallaTapada(): boolean {
  return (
    document.querySelector("[data-doty-entrada]") !== null ||
    hayScrollBloqueado() ||
    document.visibilityState === "hidden"
  );
}

/**
 * Aviso "te pasó" (spec §6.5). Vive en el layout del hub y reacciona a la
 * ruta: consulta en CADA entrada a esas tres, volver de una lección incluida.
 * Ese es el momento con más dramatismo, porque acabas de sumar XP y aun así te
 * adelantaron.
 */
export default function RivalWatch() {
  const pathname = usePathname();
  const router = useRouter();
  const { isBootstrapping, accessToken } = useAuth();
  const usuario = useStoredUser();
  const userId = usuario.id;
  // El aviso viaja con la ruta que lo pidió. El layout del hub NO se remonta al
  // cambiar de pestaña, así que un aviso suelto en el estado se iría contigo a
  // Repaso, al Perfil o a la Tienda —las tres pantallas donde `RUTAS`
  // precisamente no quiere avisar— si tocas la barra dentro de los 6 s.
  // Guardarlo junto a su ruta lo caduca solo, sin un `setAviso(null)` desde un
  // efecto (regla 3). Es lo que hacen `medida` en `hooks/use-tip-anchor.ts` y
  // `saltadas` en `components/tips/tips-controller.tsx` con sus claves.
  const [aviso, setAviso] = useState<{ ruta: string; aviso: Aviso } | null>(null);

  useEffect(() => {
    if (!RUTAS.has(pathname)) return;
    if (isBootstrapping || !accessToken) return;
    if (typeof userId !== "number") return;

    let vivo = true;
    let reloj = 0;

    getRivalService().then((data) => {
      if (!vivo || data === null) return;

      const clave = claveSnapshot(userId);
      let anterior = null;
      try {
        anterior = parsearSnapshot(window.localStorage.getItem(clave));
      } catch {
        // localStorage puede lanzar en modo privado: sin snapshot no se avisa,
        // que es exactamente lo que queremos cuando no sabemos nada.
      }

      // El puesto se guarda SIEMPRE, se avise o no: si solo se guardara al
      // avisar, una bajada sin vecino dejaría el snapshot viejo y el siguiente
      // cambio se mediría contra un puesto que ya no es el último conocido.
      // Se guarda aquí y no al pintar, también, porque la emisión puede quedar
      // esperando a que se destape la pantalla: el snapshot no depende de que
      // el aviso llegue a verse.
      try {
        window.localStorage.setItem(
          clave,
          serializarSnapshot({ rank: data.rank, weekStart: data.weekStart }),
        );
      } catch {
        // cuota llena — se avisa igual, solo que la próxima vez no habrá con qué comparar
      }

      const siguiente = decidirAviso(anterior, {
        rank: data.rank,
        weekStart: data.weekStart,
        above: data.above,
        below: data.below,
      });
      if (siguiente === null) return;

      // Sondeo con techo, como el de `use-tip-anchor`: mientras algo tape la
      // pantalla no se emite, y si el tapón no se levanta el aviso se descarta
      // sin pintarse. El `setTimeout` no es solo para reintentar: mete el
      // `setAviso` en un callback, fuera del cuerpo del efecto (regla 3).
      const desde = performance.now();
      const emitir = () => {
        if (!vivo) return;
        if (!pantallaTapada()) {
          setAviso({ ruta: pathname, aviso: siguiente });
          return;
        }
        if (performance.now() - desde >= ESPERA_TAPADO_MS) return;
        reloj = window.setTimeout(emitir, INTERVALO_MS);
      };
      reloj = window.setTimeout(emitir, 0);
    });

    return () => {
      vivo = false;
      clearTimeout(reloj);
    };
  }, [pathname, isBootstrapping, accessToken, userId]);

  const cerrar = useCallback(() => setAviso(null), []);
  const abrirRetos = useCallback(() => {
    setAviso(null);
    router.push("/quests");
  }, [router]);

  const visible = aviso !== null && aviso.ruta === pathname ? aviso.aviso : null;
  if (visible === null) return null;

  return <RivalAlert aviso={visible} onCerrar={cerrar} onAbrirRetos={abrirRetos} />;
}
