"use client";

import React, { useEffect, useMemo, useState } from "react";
import Spinner from "@/components/ui/Spinner/Spinner";
import UIButton from "@/components/ui/button/button";
import ReadingModal from "@/components/admin/reading-modal";
import {
  SearchInput,
  Toggle,
  ToastBanner,
  useToast,
} from "@/components/admin/ui";
import {
  getReadings,
  getReading,
  setReadingEnabled,
  type AdminReadingListItem,
  type AdminReading,
} from "@/services/admin.service";

export default function AdminReadingsPage() {
  const [readings, setReadings] = useState<AdminReadingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdminReading | null>(null);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [toast, flash] = useToast();

  const load = () => {
    getReadings()
      .then(setReadings)
      .catch(() => setError("Could not load readings."))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return readings;
    return readings.filter((r) => r.title.toLowerCase().includes(q));
  }, [readings, search]);

  const toggle = async (r: AdminReadingListItem) => {
    try {
      await setReadingEnabled(r.id, !r.enabled);
      setReadings((prev) =>
        prev.map((x) => (x.id === r.id ? { ...x, enabled: !x.enabled } : x)),
      );
      flash(`Reading ${!r.enabled ? "enabled" : "disabled"}.`);
    } catch {
      flash("Could not update the reading.", "error");
    }
  };

  const openEditor = async (r: AdminReadingListItem) => {
    setOpeningId(r.id);
    try {
      const full = await getReading(r.id);
      setEditing(full);
      setModalOpen(true);
    } catch {
      flash("Could not load the reading.", "error");
    } finally {
      setOpeningId(null);
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
          Readings
        </h1>
        <UIButton
          tone="accent"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          + New reading
        </UIButton>
      </div>

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search by title…"
      />

      {loading ? (
        <div className="py-16">
          <Spinner title="Loading readings…" />
        </div>
      ) : visible.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-(--border) px-5 py-8 text-center text-sm font-semibold text-(--muted)">
          {readings.length === 0
            ? "No readings yet. Add the first one!"
            : "No readings match your search."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border-2 border-(--border)">
          <table className="w-full text-left text-sm">
            <thead className="bg-(--surface) text-(--muted)">
              <tr className="text-xs font-extrabold uppercase tracking-wide">
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3 text-center">Unlock</th>
                <th className="px-4 py-3 text-center">Audio</th>
                <th className="px-4 py-3 text-center">Enabled</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className="border-t border-(--border) align-middle">
                  <td className="px-4 py-3 font-bold text-foreground">
                    {r.title || <span className="text-(--muted)">Untitled</span>}
                  </td>
                  <td
                    className="px-4 py-3 text-center text-xs font-bold text-(--muted)"
                    title={`Unlocks after completing ${r.unlock} levels`}
                  >
                    {r.unlock} lvls
                  </td>
                  <td className="px-4 py-3 text-center text-xs">
                    {r.hasAudio ? "🔊" : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Toggle on={r.enabled} onClick={() => toggle(r)} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => openEditor(r)}
                        disabled={openingId === r.id}
                        className="rounded-lg border-2 border-(--border) px-2.5 py-1 text-xs font-bold text-(--muted) transition-colors hover:border-(--accent) hover:text-(--accent) disabled:opacity-50"
                      >
                        {openingId === r.id ? "Opening…" : "Edit"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <ReadingModal
          reading={editing}
          onClose={() => setModalOpen(false)}
          onSaved={(msg) => {
            setModalOpen(false);
            load();
            flash(msg);
          }}
        />
      )}

      {toast && <ToastBanner toast={toast} />}
    </div>
  );
}
