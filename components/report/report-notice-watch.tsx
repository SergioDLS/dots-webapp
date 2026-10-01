"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import ReportNotice from "@/components/report/report-notice";
import { useAuth } from "@/context/auth-context";
import { bumpCuenta } from "@/lib/account-refresh";
import { hayScrollBloqueado } from "@/lib/scroll-lock";
import {
  getReportNoticesService,
  markReportNoticesSeenService,
  type ReportNotice as Aviso,
} from "@/services/reports.service";

/** Mismo sondeo y mismo techo que rival-watch.tsx y use-tip-anchor.ts. */
const INTERVALO_MS = 80;
const ESPERA_TAPADO_MS = 20000;

/** Los tapones de rival-watch más el propio aviso de rival, que no toma el scroll. */
function pantallaTapada(): boolean {
  return (
    document.querySelector("[data-doty-entrada]") !== null ||
    document.querySelector("[data-rival-alert]") !== null ||
    hayScrollBloqueado() ||
    document.visibilityState === "hidden"
  );
}

/**
 * Resultados de los reportes del alumno (spec 2026-10-01 §1.6). Solo al
 * entrar al Camino. El aviso viaja con su ruta, como en RivalWatch, para no
 * colarse en otra pestaña si el layout no se remonta.
 */
export default function ReportNoticeWatch() {
  const pathname = usePathname();
  const { isBootstrapping, accessToken } = useAuth();
  const [aviso, setAviso] = useState<{ ruta: string; avisos: Aviso[] } | null>(null);

  useEffect(() => {
    if (pathname !== "/levels" || isBootstrapping || !accessToken) return;
    let vivo = true;
    let reloj = 0;
    getReportNoticesService().then((avisos) => {
      if (!vivo || avisos.length === 0) return;
      const desde = performance.now();
      const emitir = () => {
        if (!vivo) return;
        if (!pantallaTapada()) {
          setAviso({ ruta: pathname, avisos });
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
  }, [pathname, isBootstrapping, accessToken]);

  const cerrar = useCallback(() => {
    const ids = aviso?.avisos.map((a) => a.id) ?? [];
    setAviso(null);
    // Si marcar falla, el aviso vuelve a salir la próxima vez: mejor que perderlo.
    markReportNoticesSeenService(ids)
      .catch(() => {})
      .finally(() => bumpCuenta());
  }, [aviso]);

  const visibles = aviso !== null && aviso.ruta === pathname ? aviso.avisos : null;
  if (!visibles) return null;
  return <ReportNotice avisos={visibles} onCerrar={cerrar} />;
}
