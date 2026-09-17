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
import { getRivalService } from "@/services/engagement.service";

/**
 * Las tres pantallas donde se avisa. A Repaso, al Perfil y a la Tienda se va
 * con una intención concreta —practicar o gestionar algo— y el aviso la
 * interrumpiría.
 */
const RUTAS = new Set(["/levels", "/play", "/quests"]);

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
  const [aviso, setAviso] = useState<Aviso | null>(null);

  useEffect(() => {
    if (!RUTAS.has(pathname)) return;
    if (isBootstrapping || !accessToken) return;
    if (typeof userId !== "number") return;

    let vivo = true;
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
      if (siguiente !== null) setAviso(siguiente);
    });

    return () => {
      vivo = false;
    };
  }, [pathname, isBootstrapping, accessToken, userId]);

  const cerrar = useCallback(() => setAviso(null), []);
  const abrirRetos = useCallback(() => {
    setAviso(null);
    router.push("/quests");
  }, [router]);

  if (aviso === null) return null;

  return <RivalAlert aviso={aviso} onCerrar={cerrar} onAbrirRetos={abrirRetos} />;
}
