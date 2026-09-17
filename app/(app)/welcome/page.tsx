"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

import WelcomeAvatar from "@/components/first-run/welcome-avatar";
import WelcomeHello from "@/components/first-run/welcome-hello";
import WelcomeTheme from "@/components/first-run/welcome-theme";
import Spinner from "@/components/ui/Spinner/Spinner";
import { useAuth } from "@/context/auth-context";
import { escribirEspejo, fijarPrimerInicio, rutaTrasBienvenida } from "@/lib/first-run";
import { readSoundEnabled, writeSoundEnabled } from "@/lib/sound-prefs";
import {
  applyThemePrefs,
  clearSettingsDirty,
  DEFAULT_PREFS,
  markSettingsDirty,
  readMirror,
  writeMirror,
  type ThemePrefs,
} from "@/lib/theme-prefs";
import { getPlacementStatusService } from "@/services/placement.service";
import { patchMySettingsService, postMyAvatarService } from "@/services/settings.service";
import { getShopService, type ShopItem } from "@/services/shop.service";

/**
 * Primer inicio guiado (spec §7.2): tres pantallas antes de ver la app.
 *
 * Ruta INMERSIVA — vive fuera del grupo (hub), así que no hereda nav ni HUD.
 * Los pasos van en estado, no en la URL: el flujo dura tres toques y no hay
 * nada que compartir ni a lo que volver con el botón atrás.
 *
 * La página es la dueña del estado; las tres pantallas son presentacionales.
 */
type Paso = 1 | 2 | 3;

/** Suscripción vacía: el valor no cambia solo, solo importa servidor vs cliente. */
const sinSuscripcion = () => () => {};

export default function WelcomePage() {
  const router = useRouter();
  const { isBootstrapping, accessToken } = useAuth();

  const [paso, setPaso] = useState<Paso>(1);
  // Dos pasos, igual que app/(app)/admin/layout.tsx: en el servidor y en el
  // primer render del cliente valen los defaults, así que no hay mismatch de
  // hidratación posible; ya hidratado se lee el espejo del dispositivo. Un
  // inicializador perezoso NO sirve: `readMirror` devuelve otra cosa en el
  // servidor que en el cliente y la pantalla de tema pinta justo ese valor.
  // Y leerlo en un efecto tampoco: `setState` en el cuerpo de un useEffect
  // rompe la regla 3.
  const hidratado = useSyncExternalStore(sinSuscripcion, () => true, () => false);
  // null = el usuario todavía no ha tocado nada y manda el espejo.
  const [prefsElegidas, setPrefsElegidas] = useState<ThemePrefs | null>(null);
  const [sonidoElegido, setSonidoElegido] = useState<boolean | null>(null);
  const prefs: ThemePrefs = prefsElegidas ?? (hidratado ? readMirror() : DEFAULT_PREFS);
  const sound: boolean = sonidoElegido ?? (hidratado ? readSoundEnabled() : true);
  const [avatares, setAvatares] = useState<ShopItem[]>([]);
  const [elegido, setElegido] = useState<string | null>(null);
  const [cerrando, setCerrando] = useState(false);

  // Los seis gratis para la pantalla 3. Mismo filtro que el perfil: gratis o
  // ya comprado. Si el sembrado todavía no se aplicó, llega vacío y la
  // pantalla 3 lo dice sin romperse.
  useEffect(() => {
    if (isBootstrapping || !accessToken) return;
    let activo = true;
    getShopService()
      .then((shop) => {
        if (activo) {
          setAvatares(shop.items.filter((i) => i.kind === "avatar" && (i.price === 0 || i.owned)));
        }
      })
      // La lista vacía ya es un caso previsto por la pantalla 3, así que un
      // fallo aquí no necesita más que no hacer ruido.
      .catch(() => undefined);
    return () => {
      activo = false;
    };
  }, [isBootstrapping, accessToken]);

  // `ThemeSync` vive en el layout del hub y `/welcome` está fuera, así que
  // aquí no hay nadie que vuelva a aplicar el tema cuando el sistema operativo
  // cambia de claro a oscuro. Sin esto, en modo Auto el resto de la pantalla
  // se repinta sola por la media query del CSS generado mientras
  // `<html class="dark">` se queda como estaba, y la vista previa —que lee esa
  // clase— enseñaría el modo equivocado.
  //
  // Se registra UNA vez y lee el espejo dentro del manejador, igual que
  // ThemeSync: con `[prefs]` el efecto se rehacía en cada render mientras
  // nadie hubiera tocado nada, porque `readMirror()` construye un objeto
  // nuevo cada vez y la igualdad referencial nunca se cumplía. El espejo
  // sirve como fuente porque `cambiarPrefs` lo escribe antes de aplicar.
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const alCambiar = () => {
      const actuales = readMirror();
      if (actuales.mode === "auto") applyThemePrefs(actuales);
    };
    mq.addEventListener("change", alCambiar);
    return () => mq.removeEventListener("change", alCambiar);
  }, []);

  // Cada cambio de tema se aplica en vivo a esta misma pantalla (spec §7.2).
  const cambiarPrefs = (siguiente: ThemePrefs) => {
    setPrefsElegidas(siguiente);
    writeMirror(siguiente);
    applyThemePrefs(siguiente);
  };

  const cambiarSonido = (on: boolean) => {
    setSonidoElegido(on);
    writeSoundEnabled(on);
  };

  /**
   * Cierra el primer inicio. `avatarKey` es null al saltar sin elegir.
   *
   * Los valores llegan por parámetro y no se leen del estado: `saltar` los
   * acaba de cambiar en el mismo tick y el closure de este render todavía
   * tiene los viejos, así que el servidor recibiría lo contrario de lo que
   * acaba de quedar en el dispositivo. Por defecto toma el estado actual,
   * que es lo que quiere el botón de terminar.
   *
   * El PATCH manda el juego completo, como la hoja de ajustes, más la marca
   * `onboarded`. NUNCA lleva `avatar_key`: esa ruta lo rechaza con 400 y el
   * avatar se equipa con POST /me/avatar.
   */
  const cerrar = (
    avatarKey: string | null,
    prefsFinales: ThemePrefs = prefs,
    sonidoFinal: boolean = sound,
  ) => {
    if (cerrando) return;
    setCerrando(true);
    markSettingsDirty();
    patchMySettingsService({
      palette: prefsFinales.palette,
      mode: prefsFinales.mode,
      sound: sonidoFinal,
      onboarded: true,
    })
      .then(() => {
        clearSettingsDirty();
        // El servidor ya tiene la marca: este dispositivo puede saltarse la
        // bienvenida sin volver a preguntar.
        escribirEspejo();
        fijarPrimerInicio("hecho");
        // El avatar se traga su propio fallo —la tienda sin sembrar, por
        // ejemplo—: el primer inicio ya quedó cerrado, el backend resuelve
        // `clasico` y el perfil permite cambiarlo luego.
        return avatarKey ? postMyAvatarService(avatarKey).catch(() => undefined) : undefined;
      })
      .catch(() => {
        // Falló el PATCH: no se marca nada, ni aquí ni en el servidor, porque
        // el primer inicio NO se guardó y volver a pedirlo es lo correcto.
        // Tampoco atrapa a nadie: con la red caída el gate falla abierto.
      })
      .then(() => getPlacementStatusService())
      .then((status) => router.replace(rutaTrasBienvenida(status)))
      .catch(() => router.replace("/levels"));
  };

  /** Saltar (spec §7.1): Rosa, Auto, sonido activado y un avatar gratis al azar. */
  const saltar = () => {
    const defecto: ThemePrefs = DEFAULT_PREFS;
    cambiarPrefs(defecto);
    cambiarSonido(true);
    const alAzar = avatares.length > 0 ? avatares[Math.floor(Math.random() * avatares.length)].key : null;
    // Explícito: `cambiarPrefs`/`cambiarSonido` acaban de programar su setState
    // y este closure todavía ve los valores anteriores.
    cerrar(alAzar, defecto, true);
  };

  if (isBootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner title="Cargando…" />
      </div>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col items-center justify-center gap-6 px-5 py-10">
      {paso === 1 && <WelcomeHello onNext={() => setPaso(2)} />}

      {paso === 2 && (
        <WelcomeTheme
          prefs={prefs}
          sound={sound}
          onPrefs={cambiarPrefs}
          onSound={cambiarSonido}
          onNext={() => setPaso(3)}
        />
      )}

      {paso === 3 && (
        <WelcomeAvatar
          items={avatares}
          pickedKey={elegido}
          onPick={setElegido}
          onFinish={() => cerrar(elegido)}
          busy={cerrando}
        />
      )}

      <button
        type="button"
        onClick={saltar}
        disabled={cerrando}
        className="text-sm font-extrabold text-(--muted) transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent) disabled:opacity-50"
      >
        Saltar
      </button>
    </main>
  );
}
