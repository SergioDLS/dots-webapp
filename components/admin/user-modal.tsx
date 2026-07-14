"use client";

import React, { useState } from "react";
import UIButton from "@/components/ui/button/button";
import { updateUser, type AdminUser } from "@/services/admin.service";
import {
  AdminModal,
  Field,
  ModalError,
  modalInputCls,
} from "@/components/admin/ui";

interface Props {
  user: AdminUser;
  onClose: () => void;
  onSaved: (message: string, updated: AdminUser) => void;
}

/** ISO timestamp → value for <input type="date"> ("" when unset). */
const toDateInput = (iso: string | null): string =>
  iso ? iso.slice(0, 10) : "";

export default function UserModal({ user, onClose, onSaved }: Props) {
  const [name, setName] = useState(user.name);
  const [lastName, setLastName] = useState(user.lastName);
  const [email, setEmail] = useState(user.email);
  const [birth, setBirth] = useState(toDateInput(user.birth));
  const [expires, setExpires] = useState(toDateInput(user.expires));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const dirty =
    name !== user.name ||
    lastName !== user.lastName ||
    email !== user.email ||
    birth !== toDateInput(user.birth) ||
    expires !== toDateInput(user.expires);

  const save = async () => {
    if (!name.trim()) {
      setErr("Please write the name.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setErr("Please write a valid email.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      const updated = await updateUser(user.id, {
        name: name.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        birth: birth || null,
        expires: expires || null,
      });
      onSaved("User updated.", updated);
    } catch (e: unknown) {
      const ex = e as { response?: { data?: { message?: string } } };
      setErr(ex?.response?.data?.message ?? "Could not save. Please try again.");
      setSaving(false);
    }
  };

  return (
    <AdminModal
      title={`Edit ${user.name || user.username || "user"}`}
      onClose={onClose}
      footer={
        <>
          <UIButton tone="neutral" onClick={onClose}>
            Cancel
          </UIButton>
          <UIButton tone="accent" onClick={save} disabled={saving || !dirty}>
            {saving ? "Saving…" : "Save changes"}
          </UIButton>
        </>
      }
    >
      <ModalError text={err} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={modalInputCls}
          />
        </Field>

        <Field label="Last name">
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className={modalInputCls}
          />
        </Field>
      </div>

      <Field label="Email">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={modalInputCls}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Birthday">
          <input
            type="date"
            value={birth}
            onChange={(e) => setBirth(e.target.value)}
            className={modalInputCls}
          />
        </Field>

        <Field label="Access expires (empty = never)">
          <input
            type="date"
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
            className={modalInputCls}
          />
        </Field>
      </div>
    </AdminModal>
  );
}
