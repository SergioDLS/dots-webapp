"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import WelcomeHello from "@/components/first-run/welcome-hello";
import Spinner from "@/components/ui/Spinner/Spinner";
import { useAuth } from "@/context/auth-context";
import { escribirEspejo, fijarPrimerInicio, rutaTrasBienvenida } from "@/lib/first-run";
import { readSoundEnabled, writeSoundEnabled } from "@/lib/sound-prefs";
import {
  applyThemePrefs,
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

export default function WelcomePage() {
  const router = useRouter();
  const { isBootstrapping, accessToken } = useAuth();

  const [paso, setPaso] = useState<Paso>(1);
  // Arranca de lo que ya hubiera: quien llega con espejo (otro dispositivo,
  // sesión anterior) no ve saltar sus colores al entrar. Inicializador
  // perezoso, no un efecto: `setState` síncrono en el cuerpo de un useEffect
  // rompe la regla 3 (react-hooks/set-state-in-effect lo marca error, no
  // warning). Mismo criterio que ThemeSync (regla 3 en su cabecera): leer el
  // espejo va en el render, no en un efecto. `readMirror`/`readSoundEnabled`
  // ya devuelven su default en SSR (sin `window`), así que es seguro.
  const [prefs, setPrefs] = useState<ThemePrefs>(() => readMirror());
  const [sound, setSound] = useState(() => readSoundEnabled());
  const [avatares, setAvatares] = useState<ShopItem[]>([]);
  const [elegido, setElegido] = useState<string | null>(null);
  const [cerrando, setCerrando] = useState(false);

  // Los seis gratis para la pantalla 3. Mismo filtro que el perfil: gratis o
  // ya comprado. Si el sembrado todavía no se aplicó, llega vacío y la
  // pantalla 3 lo dice sin romperse.
  useEffect(() => {
    if (isBootstrapping || !accessToken) return;
    let activo = true;
    getShopService().then((shop) => {
      if (activo) {
        setAvatares(shop.items.filter((i) => i.kind === "avatar" && (i.price === 0 || i.owned)));
      }
    });
    return () => {
      activo = false;
    };
  }, [isBootstrapping, accessToken]);

  // Cada cambio de tema se aplica en vivo a esta misma pantalla (spec §7.2).
  const cambiarPrefs = (siguiente: ThemePrefs) => {
    setPrefs(siguiente);
    writeMirror(siguiente);
    applyThemePrefs(siguiente);
  };

  const cambiarSonido = (on: boolean) => {
    setSound(on);
    writeSoundEnabled(on);
  };

  /**
   * Cierra el primer inicio. `avatarKey` es null al saltar sin elegir.
   * El PATCH manda el juego completo, como la hoja de ajustes, más la marca
   * `onboarded`. NUNCA lleva `avatar_key`: esa ruta lo rechaza con 400 y el
   * avatar se equipa con POST /me/avatar.
   */
  const cerrar = (avatarKey: string | null) => {
    if (cerrando) return;
    setCerrando(true);
    markSettingsDirty();
    patchMySettingsService({ palette: prefs.palette, mode: prefs.mode, sound, onboarded: true })
      .then(() => (avatarKey ? postMyAvatarService(avatarKey).then(() => undefined) : undefined))
      .catch(() => {
        // Si el avatar falla —por ejemplo, con la tienda todavía sin sembrar—
        // el primer inicio igual queda cerrado: lo contrario deja al usuario
        // dando vueltas por la bienvenida. El perfil permite cambiarlo luego.
      })
      .then(() => {
        escribirEspejo();
        fijarPrimerInicio("hecho");
        return getPlacementStatusService();
      })
      .then((status) => router.replace(rutaTrasBienvenida(status)))
      .catch(() => router.replace("/levels"));
  };

  /** Saltar (spec §7.1): Rosa, Auto, sonido activado y un avatar gratis al azar. */
  const saltar = () => {
    const defecto: ThemePrefs = { palette: "rosa", mode: "auto" };
    cambiarPrefs(defecto);
    cambiarSonido(true);
    const alAzar = avatares.length > 0 ? avatares[Math.floor(Math.random() * avatares.length)].key : null;
    cerrar(alAzar);
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

      {/* Los pasos 2 y 3 los montan las tareas siguientes de este plan. */}

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
