"use client";

import React, { useState } from "react";
import UIButton from "@/components/ui/button/button";
import {
  bulkInvitations,
  createInvitation,
  type BulkInviteResult,
} from "@/services/admin.service";
import {
  AdminModal,
  Field,
  ModalError,
  modalInputCls,
} from "@/components/admin/ui";

interface Props {
  onClose: () => void;
  // message es opcional: el bulk exitoso cierra sin toast (el resumen ya
  // quedó en el modal); la invitación individual sigue mandando el mensaje.
  onSent: (message?: string) => void;
}

type Mode = "single" | "bulk";

export default function InviteModal({ onClose, onSent }: Props) {
  const [mode, setMode] = useState<Mode>("single");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [emails, setEmails] = useState("");
  const [accessExpires, setAccessExpires] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  // Estado que guarda el resultado del bulk para mostrarlo dentro del modal.
  // null = todavía no se ha enviado (o fue un single).
  const [bulkResult, setBulkResult] = useState<BulkInviteResult | null>(null);

  const send = async () => {
    setErr("");
    setSending(true);
    try {
      if (mode === "single") {
        if (!email.trim() || !email.includes("@")) {
          setErr("Please write a valid email.");
          return;
        }
        await createInvitation({
          email: email.trim(),
          name: name.trim() || undefined,
          lastName: lastName.trim() || undefined,
          accessExpires: accessExpires || null,
        });
        // La invitación individual cabe en una línea: cerramos y mostramos toast.
        onSent(`Invitation sent to ${email.trim()}.`);
      } else {
        if (!emails.trim()) {
          setErr("Paste at least one email.");
          return;
        }
        // emails es el texto pegado tal cual; el backend lo parsea
        const result = await bulkInvitations(emails, accessExpires || null);
        // El resultado puede tener varios omitidos con motivos: mostramos el
        // resumen dentro del modal para que el admin pueda leerlo con calma.
        setBulkResult(result);
      }
    } catch (e: unknown) {
      const ex = e as { response?: { data?: { message?: string } } };
      setErr(ex?.response?.data?.message ?? "Could not send. Please try again.");
    } finally {
      // En un solo sitio, para que ningún camino pueda dejar el botón
      // bloqueado.
      setSending(false);
    }
  };

  const tabCls = (active: boolean) =>
    `rounded-xl px-4 py-2 text-sm font-extrabold transition-colors ${
      active
        ? "bg-(--accent) text-white"
        : "text-(--muted) hover:bg-(--accent)/10 hover:text-(--accent)"
    }`;

  // Pantalla de resumen del bulk: muestra cuántas se crearon y lista las
  // omitidas con su motivo, una por línea.
  if (bulkResult) {
    return (
      <AdminModal
        title="Bulk invite — results"
        onClose={() => onSent()}
        footer={
          <UIButton tone="accent" onClick={() => onSent()}>
            Done
          </UIButton>
        }
      >
        <p className="text-sm font-bold text-foreground">
          {bulkResult.created.length === 1
            ? "1 invitation sent."
            : `${bulkResult.created.length} invitations sent.`}
        </p>

        {bulkResult.skipped.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-xs font-extrabold uppercase tracking-wide text-(--muted)">
              {bulkResult.skipped.length === 1
                ? "1 skipped"
                : `${bulkResult.skipped.length} skipped`}
            </p>
            <ul className="flex flex-col gap-1">
              {bulkResult.skipped.map((s) => (
                <li
                  key={s.email}
                  className="rounded-xl border border-(--border) px-3 py-2 text-sm"
                >
                  <span className="font-bold text-foreground">{s.email}</span>
                  <span className="ml-2 text-(--muted)">— {s.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </AdminModal>
    );
  }

  return (
    <AdminModal
      title="Invite someone"
      onClose={onClose}
      footer={
        <>
          <UIButton tone="neutral" onClick={onClose}>
            Cancel
          </UIButton>
          <UIButton tone="accent" onClick={send} disabled={sending}>
            {sending ? "Sending…" : "Send invitation"}
          </UIButton>
        </>
      }
    >
      <ModalError text={err} />

      <div className="flex w-fit gap-1 rounded-2xl border-2 border-(--border) bg-(--surface) p-1">
        <button onClick={() => setMode("single")} className={tabCls(mode === "single")}>
          One person
        </button>
        <button onClick={() => setMode("bulk")} className={tabCls(mode === "bulk")}>
          Paste a list
        </button>
      </div>

      {mode === "single" ? (
        <>
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@example.com"
              className={modalInputCls}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name (optional)">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={modalInputCls}
              />
            </Field>
            <Field label="Last name (optional)">
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={modalInputCls}
              />
            </Field>
          </div>
        </>
      ) : (
        <Field label="Emails (comma, semicolon or one per line)">
          <textarea
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            rows={6}
            placeholder={"ana@example.com\nluis@example.com"}
            className={modalInputCls}
          />
        </Field>
      )}

      <Field label="Access expires (empty = never)">
        <input
          type="date"
          value={accessExpires}
          onChange={(e) => setAccessExpires(e.target.value)}
          className={modalInputCls}
        />
      </Field>
    </AdminModal>
  );
}
