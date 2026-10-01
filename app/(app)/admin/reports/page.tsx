"use client";

import { useEffect, useState } from "react";

import Spinner from "@/components/ui/Spinner/Spinner";
import UIButton from "@/components/ui/button/button";
import { ToastBanner, useToast } from "@/components/admin/ui";
import BugList from "@/components/admin/reports/bug-list";
import GroupDetail from "@/components/admin/reports/group-detail";
import GroupList from "@/components/admin/reports/group-list";
import { refrescarConteoReportes } from "@/lib/report-counts";
import {
  getBugReports,
  getReportGroups,
  type AdminBugReport,
  type AdminReportGroup,
  type AdminReportStatus,
} from "@/services/admin.service";

type Pestana = "contenido" | "bugs";

const tabCls = (on: boolean) =>
  `rounded-xl px-4 py-2 text-sm font-extrabold transition-colors ${
    on ? "bg-(--accent) text-white" : "text-(--muted) hover:bg-(--accent)/10 hover:text-(--accent)"
  }`;

/** Bandeja de reportes (spec 2026-10-01 §2). */
export default function AdminReportsPage() {
  const [pestana, setPestana] = useState<Pestana>("contenido");
  const [estado, setEstado] = useState<AdminReportStatus>("pending");
  const [grupos, setGrupos] = useState<AdminReportGroup[] | null>(null);
  const [bugs, setBugs] = useState<AdminBugReport[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [fetchAttempt, setFetchAttempt] = useState(0);
  const [abierto, setAbierto] = useState<{ type: string; id: string } | null>(null);
  const [toast, flash] = useToast();

  useEffect(() => {
    let vivo = true;
    const pedido =
      pestana === "contenido"
        ? getReportGroups(estado).then((g) => {
            if (vivo) setGrupos(g);
          })
        : getBugReports(estado).then((b) => {
            if (vivo) setBugs(b);
          });
    pedido.catch(() => {
      if (vivo) setLoadError(true);
    });
    return () => {
      vivo = false;
    };
  }, [pestana, estado, fetchAttempt]);

  // Todo reset va en el evento, nunca en el efecto (regla 3).
  const recargar = () => {
    setLoadError(false);
    setGrupos(null);
    setBugs(null);
    setFetchAttempt((n) => n + 1);
    refrescarConteoReportes();
  };
  // Relectura en el sitio: la lista se queda en pantalla mientras llega la nueva (BugList la pide
  // tras editar un ejercicio; vaciarla desmontaría el editor que sigue abierto).
  const releer = () => setFetchAttempt((n) => n + 1);
  const cambiarPestana = (p: Pestana) => {
    setPestana(p);
    setLoadError(false);
  };
  const cambiarEstado = (e: AdminReportStatus) => {
    setEstado(e);
    setGrupos(null);
    setBugs(null);
    setLoadError(false);
  };

  if (abierto) {
    return (
      <>
        <GroupDetail
          type={abierto.type}
          id={abierto.id}
          flash={flash}
          onVolver={() => {
            setAbierto(null);
            recargar();
          }}
        />
        {toast && <ToastBanner toast={toast} />}
      </>
    );
  }

  const lista = pestana === "contenido" ? grupos : bugs;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold text-foreground">Reportes</h1>
        <div className="flex w-fit gap-1 rounded-2xl border-2 border-(--border) bg-(--surface) p-1">
          <button type="button" onClick={() => cambiarEstado("pending")} className={tabCls(estado === "pending")}>
            Pendientes
          </button>
          <button type="button" onClick={() => cambiarEstado("closed")} className={tabCls(estado === "closed")}>
            Cerrados
          </button>
        </div>
      </div>

      <div className="flex w-fit gap-1 rounded-2xl border-2 border-(--border) bg-(--surface) p-1">
        <button type="button" onClick={() => cambiarPestana("contenido")} className={tabCls(pestana === "contenido")}>
          Contenido
        </button>
        <button type="button" onClick={() => cambiarPestana("bugs")} className={tabCls(pestana === "bugs")}>
          Bugs
        </button>
      </div>

      {loadError ? (
        <div className="flex flex-col items-start gap-3">
          <div className="rounded-2xl border-2 border-(--danger)/30 bg-(--danger)/10 p-4 text-sm font-bold text-(--danger)">
            No se pudieron cargar los reportes.
          </div>
          <UIButton onClick={recargar}>Reintentar</UIButton>
        </div>
      ) : lista === null ? (
        <div className="py-16">
          <Spinner title="Cargando reportes…" />
        </div>
      ) : pestana === "contenido" ? (
        <GroupList grupos={grupos ?? []} onAbrir={(type, id) => setAbierto({ type, id })} />
      ) : (
        <BugList bugs={bugs ?? []} flash={flash} onCambio={recargar} onReleer={releer} />
      )}

      {toast && <ToastBanner toast={toast} />}
    </div>
  );
}
