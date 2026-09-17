"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

import DotyTip from "@/components/ui/doty-tip/doty-tip";
import { useTipAnchor } from "@/hooks/use-tip-anchor";
import { useAuth } from "@/context/auth-context";
import { estadoPrimerInicio, suscribirPrimerInicio } from "@/lib/first-run";
import { pendientesPara } from "@/lib/tips";
import { getMySettingsService, patchMySettingsService } from "@/services/settings.service";

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

  // Mientras el primer inicio no esté resuelto, el usuario está yendo o
  // volviendo de la bienvenida: no es momento de explicarle la pantalla.
  const listo = iniciales !== null && primerInicio === "hecho";
  const cola = listo ? pendientesPara(pathname, vistas) : [];
  const actual = cola[0] ?? null;
  const total = listo ? pendientesPara(pathname, iniciales).length : 0;
  const recorte = useTipAnchor(actual?.key ?? null);

  const entendido = useCallback(() => {
    if (!actual) return;
    setVistas((v) => (v.includes(actual.key) ? v : [...v, actual.key]));
    // Optimista: si el PATCH falla, la pista no se repite en esta sesión pero
    // sí en la siguiente. Molestar una vez más es mejor que perder la
    // explicación.
    patchMySettingsService({ tips_seen: [actual.key] }).catch(() => undefined);
  }, [actual]);

  if (!actual || !recorte) return null;

  return (
    <DotyTip
      tip={actual}
      recorte={recorte}
      indice={total - cola.length + 1}
      total={total}
      onEntendido={entendido}
    />
  );
}
