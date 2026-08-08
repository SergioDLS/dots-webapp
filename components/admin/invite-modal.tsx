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
  onSent: (message: string) => void;
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

  // Describe el resultado de un bulk: cuántas se crearon y cuáles se
  // omitieron con su motivo, para que la academia vea exactamente qué pasó.
  const describe = (result: BulkInviteResult): string => {
    const parts = [`${result.created.length} invited`];
    if (result.skipped.length > 0) {
      const detail = result.skipped
        .map((s) => `${s.email} (${s.reason})`)
        .join("; ");
      parts.push(`${result.skipped.length} skipped: ${detail}`);
    }
    return parts.join(" — ");
  };

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
        onSent(`Invitation sent to ${email.trim()}.`);
      } else {
        if (!emails.trim()) {
          setErr("Paste at least one email.");
          return;
        }
        // emails es el texto pegado tal cual; el backend lo parsea
        const result = await bulkInvitations(emails, accessExpires || null);
        onSent(describe(result));
      }
    } catch (e: unknown) {
      const ex = e as { response?: { data?: { message?: string } } };
      setErr(ex?.response?.data?.message ?? "Could not send. Please try again.");
    } finally {
      // En un solo sitio, para que ningún camino pueda dejar el botón
      // bloqueado. Hoy el éxito desmonta el modal y no se notaría, pero eso
      // depende de lo que haga el padre, no de este componente.
      setSending(false);
    }
  };

  const tabCls = (active: boolean) =>
    `rounded-xl px-4 py-2 text-sm font-extrabold transition-colors ${
      active
        ? "bg-(--accent) text-white"
        : "text-(--muted) hover:bg-(--accent)/10 hover:text-(--accent)"
    }`;

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
