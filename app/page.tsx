"use client";

import React, { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { loginService } from "@/services/auth.service";
import { useAuth } from "@/context/auth-context";
import Doty, { toDotyPose } from "@/components/ui/doty/doty";
import {
  marcarVista,
  snapshotCliente,
  snapshotServidor,
  suscribir,
  pedirEntrada,
  sorteoLogin,
  ESPERA_MAX_MS,
  SALIDA_MS,
  TRANSFORMACION_SRC,
  SALUDO_SRC,
} from "@/lib/doty-transformacion";
import {
  inputCls,
  btnPrimary,
  btnOutline,
  ErrorBanner,
  AuthShell,
  PendingLabel,
} from "@/components/auth/auth-ui";

/** El backend distingue bloqueo de vencimiento; el usuario merece saber cuál. */
const REASON_ES: Record<string, string> = {
  blocked: "Tu acceso fue desactivado. Escríbenos si crees que es un error.",
  expired: "Tu acceso venció. Contacta a tu academia para renovarlo.",
};

// Formulario de contacto de la web informativa. El ancla cae directo en la
// seccion del formulario (dots-info-web, app/contacto/page.tsx: id="formulario")
// en vez de arriba de la pagina.
const CONTACT_FORM_URL = "https://dotsonlinelearning.com/contacto#formulario";

// Mismo número que el botón flotante de la web informativa (dots-info-web,
// app/components/WhatsAppButton.tsx). El mensaje sí cambia: aquí la persona
// llega desde el login, así que pregunta por el acceso a la app.
const WHATSAPP_URL = `https://wa.me/34683123178?text=${encodeURIComponent(
  "¡Hola! Me gustaría más información sobre el acceso a la app de dots.",
)}`;

// py-3 deja el alto en 44 px, el mínimo cómodo para pulsar con el pulgar.
const contactLink =
  "dots-pressable flex-1 rounded-2xl border-2 bg-(--surface) px-4 py-3 text-xs font-extrabold";

export default function Login() {
  const router = useRouter();
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [incorrect, setIncorrect] = useState(false);
  const [msg, setMsg] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const { accessToken, isBootstrapping, setAccessToken } = useAuth();

  // Se decide UNA vez y de forma síncrona: localStorage se lee sin esperar. Si
  // ya la vio, el asset de 653 kB no se pide nunca — que pasadas unas semanas
  // es el caso de todo el mundo.
  //
  // `useSyncExternalStore` y no `useState(debeAnimar)`: esta página se
  // renderiza también en el servidor, donde no hay `window`, y con useState el
  // `false` del servidor sobrevivía a la hidratación y la animación no se
  // reproducía nunca — sin un error en consola que lo delatara.
  const transformacionPendiente = useSyncExternalStore(
    suscribir,
    snapshotCliente,
    snapshotServidor,
  );
  // Una pose distinta en cada carga, para que la puerta de entrada no sea
  // siempre la misma foto. Se elige una sola vez y con el mismo mecanismo que el
  // resto: sortearla durante el render rompería la hidratación, y sin caché
  // Doty cambiaría de pose a cada tecla del formulario.
  const poseLogin = useSyncExternalStore(
    sorteoLogin.suscribir,
    sorteoLogin.cliente,
    sorteoLogin.servidor,
  );
  const [assetListo, setAssetListo] = useState(false);
  const [esperaVencida, setEsperaVencida] = useState(false);

  // Se precarga mientras el usuario escribe sus credenciales, que es tiempo que
  // de otro modo se desperdicia. `decode()` y no `onload` porque resuelve
  // cuando la imagen está lista para PINTAR: así al llegar el momento no hay
  // que esperar ni se pierde el primer fotograma.
  useEffect(() => {
    if (!transformacionPendiente) return;
    let vivo = true;
    const img = new window.Image();
    img.src = TRANSFORMACION_SRC;
    img
      .decode()
      .then(() => {
        if (vivo) setAssetListo(true);
      })
      .catch(() => {
        // Red caída o formato no soportado: no se anima y se sigue de largo.
      });
    const reloj = setTimeout(() => {
      if (vivo) setEsperaVencida(true);
    }, ESPERA_MAX_MS);
    return () => {
      vivo = false;
      clearTimeout(reloj);
    };
  }, [transformacionPendiente]);

  // El saludo también es un clip generado y necesita estar decodificado antes
  // de reproducirse. Se precarga solo cuando el formulario está de verdad a la
  // vista — arranque terminado y sin sesión —: hacerlo al montar costaría
  // 771 kB en cada apertura de la app, incluidas las que redirigen al instante
  // sin llegar a enseñarlo.
  useEffect(() => {
    if (isBootstrapping || accessToken) return;
    const img = new window.Image();
    img.src = SALUDO_SRC;
    img.decode().catch(() => {});
  }, [isBootstrapping, accessToken]);

  // `loginHandler` marca que hubo formulario. Lo necesita el efecto de abajo
  // para decidir si pedir el saludo: ese efecto también corre al rehidratar la
  // sesión desde la cookie — la mayoría de las aperturas de la app — y ahí no
  // hay nada que saludar.
  const [huboFormulario, setHuboFormulario] = useState(false);

  // Solo se hace el fundido de salida si de verdad va a haber una animación
  // detrás. Sin animación no hay nada que encadenar y los 200 ms serían un
  // retraso gratis en cada apertura de la app.
  const vaAAnimar = transformacionPendiente ? assetListo : huboFormulario;
  const saliendo = !isBootstrapping && Boolean(accessToken) && vaAAnimar;

  // auth-context ya rehidrata la sesión al montar (cookie HttpOnly de
  // refresh). Si terminó y hay token, no tiene sentido mostrar el login: en
  // una pestaña normal es solo una molestia, pero en la PWA instalada
  // (display: standalone, sin barra de direcciones) es una ratonera sin
  // salida. `replace`, no `push`, para que el botón atrás no vuelva aquí.
  //
  // La transformación se monta sobre este redirect, así que la salida está
  // protegida por los dos lados: se espera al asset como MUCHO ESPERA_MAX_MS, y
  // la marca se escribe ANTES de animar. Si el navegador se cierra a mitad, el
  // peor caso es que el usuario se la pierda — nunca que la vea en cada
  // arranque.
  useEffect(() => {
    if (isBootstrapping || !accessToken) return;
    // Espera a que el asset esté decodificado, con tope: si no da tiempo, se
    // entra sin animación antes que hacer esperar a nadie.
    if (transformacionPendiente && !assetListo && !esperaVencida) return;
    if (transformacionPendiente && assetListo) {
      // La marca se escribe ANTES de reproducir. Si algo se corta por el
      // camino, el peor caso es que el usuario se la pierda — nunca que la vea
      // en cada arranque.
      marcarVista();
      pedirEntrada("transformacion");
    } else if (huboFormulario) {
      pedirEntrada("saludo");
    }
    // Se navega cuando el fundido de salida ha terminado, para que enlace con el
    // de entrada del overlay. Sin animación detrás se va directo: no hay nada
    // con lo que encadenar.
    if (!saliendo) {
      router.replace("/levels");
      return;
    }
    const t = setTimeout(() => router.replace("/levels"), SALIDA_MS);
    return () => clearTimeout(t);
  }, [
    isBootstrapping,
    accessToken,
    router,
    transformacionPendiente,
    assetListo,
    esperaVencida,
    huboFormulario,
    saliendo,
  ]);

  // Si el refresh falló con 403 (bloqueado o vencido), api-client guarda el
  // motivo en sessionStorage antes de redirigir aquí. Lo leemos al montar,
  // mostramos el aviso y limpiamos la clave para que no reaparezca.
  // Los setState van DENTRO del efecto (regla #3 de CLAUDE.md).
  useEffect(() => {
    const reason = window.sessionStorage.getItem("dots_auth_reason");
    if (reason) {
      window.sessionStorage.removeItem("dots_auth_reason");
      setIncorrect(true);
      setMsg(REASON_ES[reason] ?? "Tu sesión terminó. Vuelve a iniciar sesión.");
    }
  }, []);

  const loginHandler = useCallback(async () => {
    setLoginLoading(true);
    try {
      const response = await loginService(user, password);
      if (response && response.token) {
        setIncorrect(false);
        setMsg("");
        setAccessToken(response.token);
        // Persiste el perfil para que los componentes (saludo, menú admin,
        // foto de perfil) puedan renderizarlo sin refetchear.
        localStorage.setItem(
          "user",
          JSON.stringify({
            id: response.id,
            username: response.username,
            name: response.name,
            last_name: response.last_name,
            profile: response.profile,
            streak: response.streak,
            profile_pic: response.profile_picture ?? null,
          }),
        );
        // Pide el saludo de bienvenida. Va aquí y no en el efecto a propósito:
        // esto solo ocurre cuando alguien escribió sus credenciales. El efecto
        // también corre al rehidratar la sesión desde la cookie — la mayoría de
        // las aperturas — y colgarlo de ahí sería un retraso en cada arranque.
        setHuboFormulario(true);
        // Aquí NO se navega. Guardar el token hace que el efecto de arriba se
        // dispare, y ese es el único sitio desde el que se sale de esta
        // pantalla: es donde vive la decisión de animar la transformación.
        // Navegar también desde aquí se adelantaría a esa decisión y la
        // animación no se vería nunca.
        //
        // La navegación sigue siendo client-side, así que AuthProvider queda
        // montado y el token en memoria sobrevive. La cookie de refresh solo se
        // usa como respaldo en recargas completas.
      } else {
        setIncorrect(true);
        const text =
          (response && (response.message || response.error)) ||
          "¡Usuario o contraseña incorrectos!";
        setMsg(text);
      }
    } catch (e: unknown) {
      setIncorrect(true);
      const ex = e as {
        response?: { data?: { message?: string; error?: string; reason?: string } };
        message?: string;
      };
      const reason = ex?.response?.data?.reason;
      const errMsg =
        (reason && REASON_ES[reason]) ||
        ex?.response?.data?.message ||
        ex?.response?.data?.error ||
        ex?.message ||
        "No pudimos entrar. Intenta de nuevo.";
      setMsg(errMsg);
    } finally {
      setLoginLoading(false);
    }
  }, [user, password, setAccessToken]);

  useEffect(() => {
    const keyDownHandler = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        if (password.length > 4) {
          loginHandler();
        }
      }
    };

    document.addEventListener("keydown", keyDownHandler);

    return () => {
      document.removeEventListener("keydown", keyDownHandler);
    };
  }, [password, loginHandler]);

  // Va después de TODOS los hooks, nunca antes: un retorno anticipado que se
  // salte alguno cambiaría el orden de llamada entre renders.
  //
  // Durante la transformación no queda nada más en pantalla — ni formulario ni
  // wordmark. El momento es el personaje, y cualquier otra cosa compite con él.
  return (
    <AuthShell>
      <div
        className="dots-compact-stack flex w-full max-w-sm flex-col gap-5 sm:gap-7"
        style={
          saliendo
            ? { animation: `dots-salida-login ${SALIDA_MS}ms ease-in both` }
            : undefined
        }
      >
        {/* Marca + mascota */}
        <div
          className="flex flex-col items-center gap-2 text-center"
          style={{ animation: "dots-slide-up 0.5s ease-out both" }}
        >
          <div style={{ animation: "dots-float 3.5s ease-in-out infinite" }}>
            {transformacionPendiente ? (
              // El Doty clásico, y es EXACTAMENTE el primer fotograma del WebP
              // — sale del mismo pipeline (compose-transformacion.py), así que
              // al arrancar la animación no hay salto: es el mismo píxel.
              //
              // Va con `next/image` y no con `<Doty>` a propósito: no es una
              // pose del registro ni debe serlo. Vive fuera de
              // public/images/Doty/, que es justo lo que recorre
              // check-doty-assets --strict buscando huérfanos.
              <Image
                src="/images/doty-clasico-login.png"
                alt=""
                width={256}
                height={256}
                priority
                className="h-auto w-28 select-none"
                draggable={false}
              />
            ) : (
              // Quieto, no en bucle: algo que se mueve sin parar en una
              // pantalla de espera acaba siendo ruido. El saludo es un clip
              // aparte y ocurre fuera de esta tarjeta, al entrar.
              <Doty pose={toDotyPose(poseLogin)} size="smaller" />
            )}
          </div>
          <h1 className="font-display text-5xl font-extrabold leading-none tracking-tight text-(--accent)">
            dots
          </h1>
          <p className="text-sm font-semibold text-(--muted)">
            ¡Hola! Soy Doty. ¿Aprendemos algo nuevo?
          </p>
        </div>

        {incorrect && <ErrorBanner text={msg} />}

        {/* Formulario */}
        <div
          className="flex flex-col gap-4"
          style={{ animation: "dots-slide-up 0.5s ease-out 0.1s both" }}
        >
          <input
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="Usuario"
            type="text"
            autoComplete="username"
            className={inputCls}
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            type="password"
            autoComplete="current-password"
            className={inputCls}
          />
          <button
            type="button"
            onClick={loginHandler}
            disabled={loginLoading}
            className={btnPrimary}
          >
            {loginLoading ? <PendingLabel text="Entrando…" /> : "¡Vamos!"}
          </button>
        </div>

        {/* Enlaces secundarios */}
        <div
          className="flex flex-col gap-2.5"
          style={{ animation: "dots-slide-up 0.5s ease-out 0.2s both" }}
        >
          <button
            type="button"
            onClick={() => router.push("/forgot")}
            className={btnOutline}
          >
            ¿Olvidaste tu contraseña?
          </button>
          <div className="dots-compact-list flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-(--border) px-4 py-4 text-center">
            <Doty pose="senalando" size="micro" />
            <p className="text-xs font-bold text-(--muted)">
              ¿No tienes cuenta? La app es parte de los beneficios de{" "}
              <span className="font-extrabold text-foreground">
                Dots Academia de Idiomas
              </span>
              . Escríbenos y te contamos cómo entrar.
            </p>
            <div className="flex w-full flex-row gap-2">
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={contactLink}
                // El verde vive en el borde y el canto, no en el texto:
                // --success sobre blanco da 2.1:1, muy por debajo del 4.5:1 que
                // pide un texto de 12 px.
                style={
                  {
                    borderColor:
                      "color-mix(in srgb, var(--success) 60%, var(--border))",
                    color: "var(--foreground)",
                    "--press-color":
                      "color-mix(in srgb, var(--success) 70%, var(--border))",
                  } as React.CSSProperties
                }
              >
                WhatsApp
              </a>
              <a
                href={CONTACT_FORM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={`${contactLink} border-(--border) text-(--muted) hover:border-(--accent) hover:text-(--accent)`}
              >
                Contáctanos
              </a>
            </div>
          </div>
        </div>
      </div>
    </AuthShell>
  );
}
