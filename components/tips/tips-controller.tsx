"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

import DotyTip from "@/components/ui/doty-tip/doty-tip";
import { useTipAnchor } from "@/hooks/use-tip-anchor";
import { useAuth } from "@/context/auth-context";
import { estadoPrimerInicio, suscribirPrimerInicio } from "@/lib/first-run";
import { pendientesPara, type Tip } from "@/lib/tips";
import { getMySettingsService, patchMySettingsService } from "@/services/settings.service";

interface PistaProps {
  tip: Tip;
  indice: number;
  total: number;
  onEntendido: () => void;
  onRendirse: () => void;
}

/**
 * La pista que toca ahora. Está en su propio componente porque el controlador
 * le pone `key={tip.key}`: así el hook de medición se monta de cero con cada
 * pista y no puede devolver la medida de la anterior. Sin ese remonte, salir a
 * una pantalla sin pistas (`/shop`) y volver con el botón atrás devolvería el
 * recorte de la visita anterior —misma clave, medida ya hecha— y el foco
 * aparecería donde estaba antes de navegar.
 */
function Pista({ tip, indice, total, onEntendido, onRendirse }: PistaProps) {
  const recorte = useTipAnchor(tip.key, onRendirse);
  if (recorte === null) return null;
  return (
    <DotyTip
      tip={tip}
      recorte={recorte}
      indice={indice}
      total={total}
      onEntendido={onEntendido}
    />
  );
}

/**
 * Pistas contextuales (spec §7.3): decide cuál toca en esta pantalla y la
 * enseña una sola vez.
 *
 * Va en el layout del hub, que se monta una vez por carga de página: así
 * `/me/settings` se pide una vez aunque el usuario recorra las cinco
 * pestañas. Encuentra a qué apuntar por `data-tip` en el DOM y no por refs,
 * porque la llama de la racha vive en la cabecera del propio layout y ninguna
 * página podría pasársela.
 */
export default function TipsController() {
  const pathname = usePathname();
  const { isBootstrapping, accessToken } = useAuth();
  const primerInicio = useSyncExternalStore(
    suscribirPrimerInicio,
    estadoPrimerInicio,
    () => "desconocido" as const,
  );

  // `iniciales` es la foto que llegó del servidor y no cambia: da el total del
  // contador. `vistas` crece según se marcan y dice cuál toca ahora.
  const [iniciales, setIniciales] = useState<string[] | null>(null);
  const [vistas, setVistas] = useState<string[]>([]);
  // Las que no llegaron a encontrar a qué apuntar. Viajan con su ruta, así
  // volver a entrar a la pantalla las reintenta y no hace falta borrarlas
  // desde un efecto (regla 3). No se marcan como vistas: no se han enseñado.
  const [saltadas, setSaltadas] = useState<{ ruta: string; claves: string[] }>({
    ruta: "",
    claves: [],
  });

  useEffect(() => {
    if (isBootstrapping || !accessToken) return;
    let vivo = true;
    getMySettingsService().then((s) => {
      if (!vivo) return;
      const ya = s?.tips_seen ?? [];
      setIniciales(ya);
      setVistas(ya);
    });
    return () => {
      vivo = false;
    };
  }, [isBootstrapping, accessToken]);

  const fuera = saltadas.ruta === pathname ? saltadas.claves : [];
  // Mientras el primer inicio no esté resuelto, el usuario está yendo o
  // volviendo de la bienvenida: no es momento de explicarle la pantalla.
  const listo = iniciales !== null && primerInicio === "hecho";
  const cola = listo
    ? pendientesPara(pathname, vistas).filter((t) => !fuera.includes(t.key))
    : [];
  const actual = cola[0] ?? null;
  const total = listo
    ? pendientesPara(pathname, iniciales).filter((t) => !fuera.includes(t.key)).length
    : 0;

  const entendido = useCallback(() => {
    if (!actual) return;
    setVistas((v) => (v.includes(actual.key) ? v : [...v, actual.key]));
    // Optimista: si el PATCH falla, la pista no se repite en esta sesión pero
    // sí en la siguiente. Molestar una vez más es mejor que perder la
    // explicación.
    patchMySettingsService({ tips_seen: [actual.key] }).catch(() => undefined);
  }, [actual]);

  const rendirse = useCallback(() => {
    if (!actual) return;
    const clave = actual.key;
    setSaltadas((s) => {
      if (s.ruta !== pathname) return { ruta: pathname, claves: [clave] };
      return s.claves.includes(clave) ? s : { ruta: pathname, claves: [...s.claves, clave] };
    });
  }, [actual, pathname]);

  if (!actual) return null;

  return (
    <Pista
      key={actual.key}
      tip={actual}
      indice={total - cola.length + 1}
      total={total}
      onEntendido={entendido}
      onRendirse={rendirse}
    />
  );
}
