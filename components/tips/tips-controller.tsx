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
 * La pista que toca ahora. Está en su propio componente porque lleva
 * `key={tip.key}`: así el hook de medición se monta de cero con cada pista y
 * no puede devolver la medida de la anterior. Sin ese remonte, salir a una
 * pantalla sin pistas (`/shop`) y volver con el botón atrás devolvería el
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

interface PantallaProps {
  ruta: string;
  /** La foto que llegó del servidor: da el total del contador y no cambia. */
  iniciales: readonly string[];
  /** Lo que ya se marcó, incluido lo de esta sesión: dice cuál toca ahora. */
  vistas: readonly string[];
  onVista: (clave: string) => void;
}

/**
 * Las pistas de UNA pantalla. Lleva `key={pathname}`, así que salir y volver
 * lo remonta y olvida lo que se saltó: si el objetivo no estaba la primera vez
 * —porque su fetch no había llegado—, la siguiente visita lo reintenta. Dentro
 * de una misma visita no se reintenta, para no dar vueltas sobre un objetivo
 * que no va a aparecer.
 */
function Pantalla({ ruta, iniciales, vistas, onVista }: PantallaProps) {
  // Las que no llegaron a encontrar a qué apuntar. NO se marcan como vistas:
  // no se han enseñado, así que siguen pendientes en el servidor.
  const [saltadas, setSaltadas] = useState<readonly string[]>([]);

  const cola = pendientesPara(ruta, vistas).filter((t) => !saltadas.includes(t.key));
  const actual = cola[0] ?? null;
  const total = pendientesPara(ruta, iniciales).filter((t) => !saltadas.includes(t.key)).length;

  const entendido = useCallback(() => {
    if (actual) onVista(actual.key);
  }, [actual, onVista]);

  const rendirse = useCallback(() => {
    if (!actual) return;
    const clave = actual.key;
    setSaltadas((s) => (s.includes(clave) ? s : [...s, clave]));
  }, [actual]);

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

  const [iniciales, setIniciales] = useState<readonly string[] | null>(null);
  const [vistas, setVistas] = useState<readonly string[]>([]);

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

  const marcarVista = useCallback((clave: string) => {
    setVistas((v) => (v.includes(clave) ? v : [...v, clave]));
    // Optimista: si el PATCH falla, la pista no se repite en esta sesión pero
    // sí en la siguiente. Molestar una vez más es mejor que perder la
    // explicación.
    patchMySettingsService({ tips_seen: [clave] }).catch(() => undefined);
  }, []);

  // Mientras el primer inicio no esté resuelto, el usuario está yendo o
  // volviendo de la bienvenida: no es momento de explicarle la pantalla.
  if (iniciales === null || primerInicio !== "hecho") return null;

  return (
    <Pantalla
      key={pathname}
      ruta={pathname}
      iniciales={iniciales}
      vistas={vistas}
      onVista={marcarVista}
    />
  );
}
