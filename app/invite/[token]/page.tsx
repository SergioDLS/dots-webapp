"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  acceptInvitationService,
  getInvitationService,
  type InvitationPreview,
} from "@/services/auth.service";
import { useAuth } from "@/context/auth-context";
import Doty from "@/components/ui/doty/doty";
import {
  inputCls,
  btnPrimary,
  btnOutline,
  ErrorBanner,
  AuthShell,
  PendingLabel,
} from "@/components/auth/auth-ui";

/** Por qué el link no sirve. El backend lo manda en `reason`. */
type Rejection = "notfound" | "expired" | "revoked" | "used";

const REJECTION_COPY: Record<Rejection, { title: string; body: string; pose: string }> = {
  expired: {
    title: "Este enlace ya venció",
    body: "Las invitaciones duran 48 horas. Pídele a tu academia que te mande una nueva.",
    pose: "05",
  },
  revoked: {
    title: "Esta invitación fue cancelada",
    body: "Tu academia canceló este enlace. Si crees que es un error, escríbeles.",
    pose: "05",
  },
  used: {
    title: "Esta invitación ya se usó",
    body: "Tu cuenta ya existe. Entra con tu usuario y contraseña.",
    pose: "02",
  },
  notfound: {
    title: "No encontramos esta invitación",
    body: "Revisa que hayas copiado el enlace completo, sin cortar nada.",
    pose: "05",
  },
};

const GENERIC_ERROR = "Algo falló de nuestro lado. Intenta de nuevo.";

function readRejection(e: unknown): Rejection | null {
  const reason = (e as { response?: { data?: { reason?: string } } })?.response
    ?.data?.reason;
  return reason && reason in REJECTION_COPY ? (reason as Rejection) : null;
}

function readMessage(e: unknown): string {
  const raw = (e as { response?: { data?: { message?: string | string[] } } })
    ?.response?.data?.message;
  if (Array.isArray(raw)) return "Revisa los datos: algo no tiene el formato correcto.";
  if (raw === "That username is already taken")
    return "Ese usuario ya está tomado. Prueba con otro.";
  return raw || GENERIC_ERROR;
}

export default function AcceptInvite() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = params.token;
  const { setAccessToken } = useAuth();

  const [invite, setInvite] = useState<InvitationPreview | null>(null);
  const [rejection, setRejection] = useState<Rejection | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [fetchAttempt, setFetchAttempt] = useState(0);

  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [birthday, setBirthday] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Patrón fetchAttempt (regla #3 de CLAUDE.md): el efecto solo fetchea; el
  // botón Reintentar bumpea el contador. Nada de setState síncrono aquí.
  useEffect(() => {
    let mounted = true;
    getInvitationService(token)
      .then((data) => {
        if (!mounted) return;
        setInvite(data);
        setName(data.name);
        setLastName(data.lastName);
      })
      .catch((e) => {
        if (!mounted) return;
        const reason = readRejection(e);
        if (reason) setRejection(reason);
        else setLoadError(true);
      });
    return () => {
      mounted = false;
    };
  }, [token, fetchAttempt]);

  const submit = async () => {
    if (!name.trim()) {
      setError("Escribe tu nombre.");
      return;
    }
    if (!lastName.trim()) {
      setError("Escribe tu apellido.");
      return;
    }
    if (username.trim().length < 3) {
      setError("Tu usuario necesita al menos 3 caracteres.");
      return;
    }
    if (password.length < 8) {
      setError("Tu contraseña debe tener 8 caracteres o más.");
      return;
    }
    if (password !== password2) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setError("");
    setSaving(true);
    try {
      const response = await acceptInvitationService({
        token,
        username: username.trim(),
        password,
        name: name.trim(),
        lastName: lastName.trim(),
        birthday: birthday || undefined,
      });
      setAccessToken(response.token);
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
      router.push("/onboarding");
    } catch (e) {
      const reason = readRejection(e);
      if (reason) setRejection(reason);
      else setError(readMessage(e));
      setSaving(false);
    }
  };

  let content = null;

  if (rejection) {
    const copy = REJECTION_COPY[rejection];
    content = (
      <div
        className="flex w-full max-w-sm flex-col items-center gap-6 text-center"
        style={{ animation: "dots-pop-in 0.5s ease-out both" }}
      >
        <Doty pose={copy.pose} size="smaller" animation={rejection === "used" ? "cheer" : "sad"} />
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
          {copy.title}
        </h1>
        <p className="text-sm font-semibold text-(--muted)">{copy.body}</p>
        <button type="button" onClick={() => router.push("/")} className={btnPrimary}>
          Ir a iniciar sesión
        </button>
      </div>
    );
  } else if (loadError) {
    content = (
      <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
        <Doty pose="05" size="smaller" animation="sad" />
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
          ¡Ups!
        </h1>
        <p className="text-sm font-semibold text-(--muted)">
          No pudimos revisar tu invitación. Puede ser la conexión.
        </p>
        <button
          type="button"
          onClick={() => {
            setLoadError(false);
            setFetchAttempt((n) => n + 1);
          }}
          className={btnPrimary}
        >
          Reintentar
        </button>
      </div>
    );
  } else if (!invite) {
    content = (
      <div className="flex flex-col items-center gap-4 text-center">
        <div style={{ animation: "dots-float 1.5s ease-in-out infinite" }}>
          <Doty pose="07" size="tiny" />
        </div>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-(--border) border-t-(--accent)" />
        <p className="text-sm font-bold text-(--muted)">Revisando tu invitación…</p>
      </div>
    );
  } else {
    content = (
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex w-full max-w-2xl flex-col gap-7"
      >
        <div
          className="flex flex-col items-center gap-2 text-center"
          style={{ animation: "dots-slide-up 0.5s ease-out both" }}
        >
          <Doty pose="17" size="smaller" animation="cheer" />
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
            ¡Te estábamos esperando!
          </h1>
          <p className="text-sm font-semibold text-(--muted)">
            Te invitaron a dots con el correo{" "}
            <span className="font-extrabold text-foreground">{invite.email}</span>.
            Crea tu cuenta y empezamos.
          </p>
        </div>

        {error && <ErrorBanner text={error} />}

        <div className="grid gap-4 md:grid-cols-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre"
            type="text"
            autoComplete="given-name"
            className={inputCls}
          />
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Apellido"
            type="text"
            autoComplete="family-name"
            className={inputCls}
          />
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Elige tu usuario"
            type="text"
            autoComplete="username"
            className={`${inputCls} md:col-span-2`}
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            type="password"
            autoComplete="new-password"
            className={inputCls}
          />
          <input
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            placeholder="Repite la contraseña"
            type="password"
            autoComplete="new-password"
            className={inputCls}
          />
          <input
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
            type="date"
            className={`${inputCls} md:col-span-2 text-(--muted)`}
          />
        </div>

        <div className="flex flex-col gap-2.5">
          <button type="submit" disabled={saving} className={btnPrimary}>
            {saving ? <PendingLabel text="Creando tu cuenta…" /> : "Crear mi cuenta"}
          </button>
          <button type="button" onClick={() => router.push("/")} className={btnOutline}>
            Ya tengo cuenta
          </button>
        </div>
      </form>
    );
  }

  return <AuthShell>{content}</AuthShell>;
}
