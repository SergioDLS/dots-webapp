"use client";

import React, { useEffect, useMemo, useState } from "react";
import Spinner from "@/components/ui/Spinner/Spinner";
import UIButton from "@/components/ui/button/button";
import InviteModal from "@/components/admin/invite-modal";
import { SearchInput } from "@/components/admin/ui";
import {
  getInvitations,
  resendInvitation,
  revokeInvitation,
  type AdminInvitation,
  type InvitationStatus,
} from "@/services/admin.service";

const fmtDate = (iso: string | null): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
};

const STATUS_STYLE: Record<InvitationStatus, string> = {
  pending: "bg-(--accent)/15 text-(--accent)",
  accepted: "bg-(--gem)/15 text-(--gem)",
  expired: "bg-(--flame)/15 text-(--flame)",
  revoked: "bg-(--danger)/15 text-(--danger)",
};

interface Props {
  // Firma exacta de useToast en components/admin/ui.tsx:23 — "ok", no "success".
  flash: (text: string, kind?: "ok" | "error") => void;
}

export default function InvitationsTab({ flash }: Props) {
  const [rows, setRows] = useState<AdminInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [fetchAttempt, setFetchAttempt] = useState(0);
  const [search, setSearch] = useState("");
  const [inviting, setInviting] = useState(false);

  // Patrón fetchAttempt: el efecto solo fetchea; Retry bumpea el contador.
  useEffect(() => {
    let mounted = true;
    getInvitations()
      .then((data) => {
        if (mounted) setRows(data);
      })
      .catch(() => {
        if (mounted) setLoadError(true);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [fetchAttempt]);

  const reload = () => {
    setLoading(true);
    setLoadError(false);
    setFetchAttempt((n) => n + 1);
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.email, r.name, r.lastName, r.status].join(" ").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const failed = (e: unknown) => {
    const ex = e as { response?: { data?: { message?: string } } };
    flash(ex?.response?.data?.message ?? "Something went wrong.", "error");
  };

  const resend = async (row: AdminInvitation) => {
    if (!confirm(`Resend to ${row.email}? The previous link stops working.`)) return;
    try {
      const updated = await resendInvitation(row.id);
      setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
      flash(`Invitation resent to ${row.email}.`);
    } catch (e) {
      failed(e);
    }
  };

  const revoke = async (row: AdminInvitation) => {
    if (!confirm(`Revoke the invitation for ${row.email}?`)) return;
    try {
      const updated = await revokeInvitation(row.id);
      setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
      flash(`Invitation revoked.`);
    } catch (e) {
      failed(e);
    }
  };

  // El link se arma con el origen actual, no con el del backend: así en
  // desarrollo no se copia un enlace que apunta a producción.
  const copyLink = async (row: AdminInvitation) => {
    const link = `${window.location.origin}/invite/${row.token}`;
    try {
      await navigator.clipboard.writeText(link);
      flash("Link copied to clipboard.");
    } catch {
      flash(link, "error");
    }
  };

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-(--border) px-5 py-10 text-center">
        <p className="text-sm font-bold text-(--muted)">
          Could not load invitations.
        </p>
        <UIButton tone="accent" onClick={reload}>
          Retry
        </UIButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-bold text-(--muted)">
          {rows.filter((r) => r.status === "pending").length} pending ·{" "}
          {rows.length} total
        </span>
        <UIButton tone="accent" onClick={() => setInviting(true)}>
          Invite someone
        </UIButton>
      </div>

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search by email or status…"
      />

      {loading ? (
        <div className="py-16">
          <Spinner title="Loading invitations…" />
        </div>
      ) : visible.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-(--border) px-5 py-8 text-center text-sm font-semibold text-(--muted)">
          {rows.length === 0
            ? "No invitations yet. Invite someone to get started."
            : "No invitations match your search."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border-2 border-(--border)">
          <table className="w-full text-left text-sm">
            <thead className="bg-(--surface) text-(--muted)">
              <tr className="text-xs font-extrabold uppercase tracking-wide">
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3">Invited by</th>
                <th className="px-4 py-3">Sent</th>
                <th className="px-4 py-3">Link expires</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className="border-t border-(--border) align-middle">
                  <td className="px-4 py-3 font-bold text-foreground">{r.email}</td>
                  <td className="px-4 py-3 font-semibold text-(--muted)">
                    {`${r.name} ${r.lastName}`.trim() || "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${STATUS_STYLE[r.status]}`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-(--muted)">
                    {r.invitedByName || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-(--muted)">
                    {fmtDate(r.lastSentAt)}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-(--muted)">
                    {r.status === "pending" ? fmtDate(r.expiresAt) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {r.status === "pending" && (
                        <>
                          <button
                            onClick={() => copyLink(r)}
                            className="rounded-lg border-2 border-(--border) px-2.5 py-1 text-xs font-bold text-(--muted) transition-colors hover:border-(--accent) hover:text-(--accent)"
                          >
                            Copy link
                          </button>
                          <button
                            onClick={() => resend(r)}
                            className="rounded-lg border-2 border-(--border) px-2.5 py-1 text-xs font-bold text-(--muted) transition-colors hover:border-(--accent) hover:text-(--accent)"
                          >
                            Resend
                          </button>
                          <button
                            onClick={() => revoke(r)}
                            className="rounded-lg border-2 border-(--border) px-2.5 py-1 text-xs font-bold text-(--muted) transition-colors hover:border-(--danger) hover:text-(--danger)"
                          >
                            Revoke
                          </button>
                        </>
                      )}
                      {r.status === "expired" && (
                        <button
                          onClick={() => resend(r)}
                          className="rounded-lg border-2 border-(--border) px-2.5 py-1 text-xs font-bold text-(--muted) transition-colors hover:border-(--accent) hover:text-(--accent)"
                        >
                          Resend
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {inviting && (
        <InviteModal
          onClose={() => setInviting(false)}
          onSent={(message) => {
            setInviting(false);
            flash(message);
            reload();
          }}
        />
      )}
    </div>
  );
}
