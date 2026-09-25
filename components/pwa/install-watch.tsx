"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

import InstallSheet from "@/components/pwa/install-sheet";
import { useAuth } from "@/context/auth-context";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { estadoPrimerInicio, suscribirPrimerInicio } from "@/lib/first-run";
import {
  consumirActividadCompletada,
  guardarMarca,
  hayActividadCompletada,
  leerMarca,
} from "@/lib/install-browser";
import { decidirAviso, marcarVista } from "@/lib/install-prompt";
import { hayScrollBloqueado } from "@/lib/scroll-lock";

/**
 * Cuándo se invita a instalar dots: al volver al hub después de terminar una
 * lección, una práctica o un repaso.
 *
 * Ese momento y no el arranque. Pedir que te instalen antes de haber hecho
 * nada es pedir un favor a un desconocido; después de la primera lección, el
 * usuario ya sabe qué está metiendo en su pantalla de inicio. Además, en
 * Android un "no" gasta el `beforeinstallprompt` de esa carga, así que la
 * única pregunta que tenemos conviene hacerla cuando hay más posibilidades de
 * un sí.
 *
 * Vive en el layout del hub, que se monta una vez por carga de página y
 * sobrevive al cambio de pestañas, igual que TipsController y RivalWatch.
 */

/** Respiro tras aterrizar en el hub, para no pisar la animación de llegada. */
const RESPIRO_MS = 1200;

/** Cada cuánto se mira si la pantalla ya se destapó. */
const INTERVALO_MS = 120;

/**
 * Techo de la espera a que se destape, igual que en `RivalWatch` y
 * `use-tip-anchor`. Pasado ese rato se descarta: una invitación que aparece
 * medio minuto después de terminar la lección ya no la relaciona con nada.
 */
const ESPERA_TAPADO_MS = 20000;

/**
 * Lo que tapa: el overlay de entrada de Doty y cualquier diálogo que tenga
 * tomado el scroll (una pista contextual, la hoja de ajustes, el selector de
 * avatar). Una pestaña de fondo cuenta igual — abrir la hoja a espaldas del
 * usuario la gastaría sin que la viera.
 */
function pantallaTapada(): boolean {
  return (
    document.querySelector("[data-doty-entrada]") !== null ||
    hayScrollBloqueado() ||
    document.visibilityState === "hidden"
  );
}

export default function InstallWatch() {
  const pathname = usePathname();
  const { isBootstrapping, accessToken } = useAuth();
  const primerInicio = useSyncExternalStore(
    suscribirPrimerInicio,
    estadoPrimerInicio,
    () => "desconocido" as const,
  );
  const { listo, instalada, movil, guion, instalar } = useInstallPrompt();
  const [abierta, setAbierta] = useState(false);

  useEffect(() => {
    // `listo` es falso hasta que hidrata: antes de eso `guion` y `movil` son
    // relleno y decidir con ellos sería decidir a ciegas.
    if (!listo) return;
    if (isBootstrapping || !accessToken) return;
    // Quien está yendo o volviendo de la bienvenida no ha terminado nada
    // todavía; mismo criterio que TipsController.
    if (primerInicio !== "hecho") return;
    if (!hayActividadCompletada()) return;

    // A partir de aquí el disparo se gasta pase lo que pase. Si se dejara
    // puesto al descartar, la invitación quedaría al acecho y saltaría en la
    // siguiente pantalla del hub sin que nadie hubiera terminado nada.
    consumirActividadCompletada();

    const marca = leerMarca();
    if (!decidirAviso({ instalada, movil, guion, marca, ahora: Date.now() })) return;

    // La marca se escribe AL ABRIR y no al cerrar: si el usuario mata la
    // pestaña con la hoja delante, la invitación ya se gastó — el fallo caro
    // es repetirla, no perderla.
    guardarMarca(marcarVista(marca, Date.now()));

    // Sondeo con techo, como en RivalWatch: mientras algo tape la pantalla no
    // se abre. El `setTimeout` no es solo para reintentar — mete el `setState`
    // en un callback, fuera del cuerpo del efecto (regla 3).
    let reloj = 0;
    let vivo = true;
    const desde = performance.now();
    const abrir = () => {
      if (!vivo) return;
      if (!pantallaTapada()) {
        setAbierta(true);
        return;
      }
      if (performance.now() - desde >= ESPERA_TAPADO_MS) return;
      reloj = window.setTimeout(abrir, INTERVALO_MS);
    };
    reloj = window.setTimeout(abrir, RESPIRO_MS);

    return () => {
      vivo = false;
      clearTimeout(reloj);
    };
    // `pathname` está aquí para que el efecto se reevalúe en cada llegada al
    // hub: es el cambio de ruta lo que trae al usuario de vuelta de la
    // lección. No se filtra por ruta concreta porque un repaso termina en
    // /review y una lección en /levels, y las dos cuentan.
  }, [pathname, listo, isBootstrapping, accessToken, primerInicio, instalada, movil, guion]);

  const cerrar = useCallback(() => setAbierta(false), []);

  // Instalar cierra la hoja antes de abrir el diálogo del sistema: lo que
  // viene encima es de Android, y dejar la nuestra debajo se ve como dos
  // capas de lo mismo. El sello de "ya instalada" no se pone aquí sino en el
  // evento `appinstalled` (lib/install-browser.ts): entre el botón y la
  // instalación hay un diálogo que se puede cancelar.
  const aceptar = useCallback(() => {
    setAbierta(false);
    void instalar();
  }, [instalar]);

  if (!abierta) return null;

  return <InstallSheet guion={guion} onInstalar={aceptar} onCerrar={cerrar} />;
}
