"use client";

import React, { useEffect, useMemo, useState } from "react";
import Spinner from "@/components/ui/Spinner/Spinner";
import UserModal from "@/components/admin/user-modal";
import {
  SearchInput,
  Toggle,
  ToastBanner,
  useToast,
} from "@/components/admin/ui";
import {
  getUsers,
  setUserBlocked,
  type AdminUser,
} from "@/services/admin.service";
import { ADMIN_PROFILE } from "@/constants";

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

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [toast, flash] = useToast();

  useEffect(() => {
    getUsers()
      .then(setUsers)
      .catch(() => setError("Could not load users."))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.name, u.lastName, u.email, u.username]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [users, search]);

  const toggleBlocked = async (u: AdminUser) => {
    const action = u.blocked ? "unblock" : "block";
    if (!confirm(`${action === "block" ? "Block" : "Unblock"} ${u.name} ${u.lastName}?`))
      return;
    try {
      await setUserBlocked(u.id, !u.blocked);
      setUsers((prev) =>
        prev.map((x) => (x.id === u.id ? { ...x, blocked: !x.blocked } : x)),
      );
      flash(`User ${action}ed.`);
    } catch (e: unknown) {
      const ex = e as { response?: { data?: { message?: string } } };
      flash(ex?.response?.data?.message ?? "Could not update the user.", "error");
    }
  };

  if (error) {
    return (
      <div className="rounded-2xl border-2 border-(--danger)/30 bg-(--danger)/10 px-5 py-4 text-sm font-bold text-(--danger)">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold text-foreground">
          Users
        </h1>
        <span className="text-sm font-bold text-(--muted)">
          {users.length} registered
        </span>
      </div>

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search by name or email…"
      />

      {loading ? (
        <div className="py-16">
          <Spinner title="Loading users…" />
        </div>
      ) : visible.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-(--border) px-5 py-8 text-center text-sm font-semibold text-(--muted)">
          No users match your search.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border-2 border-(--border)">
          <table className="w-full text-left text-sm">
            <thead className="bg-(--surface) text-(--muted)">
              <tr className="text-xs font-extrabold uppercase tracking-wide">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3 text-center">XP</th>
                <th className="px-4 py-3 text-center">Streak</th>
                <th className="px-4 py-3">Member since</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3 text-center">Active</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((u) => (
                <tr key={u.id} className="border-t border-(--border) align-middle">
                  <td className="px-4 py-3 font-bold text-foreground">
                    {u.name} {u.lastName}
                    {u.profile === ADMIN_PROFILE && (
                      <span className="ml-2 rounded-full bg-(--accent)/15 px-2 py-0.5 text-[10px] font-extrabold text-(--accent)">
                        ADMIN
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold text-(--muted)">
                    {u.email || u.username || "—"}
                  </td>
                  <td className="px-4 py-3 text-center text-xs font-bold text-(--muted)">
                    {u.xp}
                  </td>
                  <td className="px-4 py-3 text-center text-xs font-bold text-(--muted)">
                    {u.streak > 0 ? `🔥${u.streak}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-(--muted)">
                    {fmtDate(u.creationDate)}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-(--muted)">
                    {u.expires ? fmtDate(u.expires) : "Never"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Toggle
                      on={!u.blocked}
                      onClick={() => toggleBlocked(u)}
                      title={u.blocked ? "Blocked — click to unblock" : "Active — click to block"}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => setEditing(u)}
                        className="rounded-lg border-2 border-(--border) px-2.5 py-1 text-xs font-bold text-(--muted) transition-colors hover:border-(--accent) hover:text-(--accent)"
                      >
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <UserModal
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={(msg, updated) => {
            setEditing(null);
            setUsers((prev) =>
              prev.map((x) => (x.id === updated.id ? updated : x)),
            );
            flash(msg);
          }}
        />
      )}

      {toast && <ToastBanner toast={toast} />}
    </div>
  );
}
