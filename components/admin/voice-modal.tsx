"use client";

import React from "react";
import UIButton from "@/components/ui/button/button";
import { AdminModal } from "@/components/admin/ui";
import VoiceStudio, {
  type VoiceStudioProps,
} from "@/components/admin/voice-studio";

/**
 * Los cuatro campos del studio se heredan en vez de repetirse: escritos a mano
 * eran una superficie de deriva (el modal solo los reenvía tal cual).
 */
export type VoiceModalProps = VoiceStudioProps & {
  title: string;
  onClose: () => void;
};

/**
 * Envoltorio de modal para `VoiceStudio`.
 *
 * ⚠️ Hereda el requisito del studio: dale `key={item.id}` donde lo montes. El
 * studio siembra su estado interno desde `live`, así que reusar la instancia
 * entre dos ítems mostraría la toma del anterior.
 *
 * ⚠️ Y hereda el otro: `characters` tiene que ser el elenco REAL. Con un elenco
 * vacío el selector de narrador mostraría "Auto" sobre un valor que no lo es.
 * Cuando el elenco no está, monta `VoiceRosterModal` en su lugar.
 */
export default function VoiceModal({
  title,
  live,
  characters,
  onDraft,
  onPublish,
  onClose,
}: VoiceModalProps) {
  return (
    // El studio lleva selector de narrador, dos reproductores y cuatro sliders:
    // en el ancho por defecto va apretado.
    <AdminModal
      title={title}
      onClose={onClose}
      wide
      footer={
        <UIButton tone="neutral" onClick={onClose}>
          Cerrar
        </UIButton>
      }
    >
      <VoiceStudio
        live={live}
        characters={characters}
        onDraft={onDraft}
        onPublish={onPublish}
      />
    </AdminModal>
  );
}

/**
 * Lo que se abre cuando el elenco de narradores todavía no está: el studio NO
 * se monta sin él, pero el botón "Voz" tampoco puede quedar muerto — el admin
 * necesita saber qué pasó y poder reintentar.
 */
export function VoiceRosterModal({
  title,
  error,
  onRetry,
  onClose,
}: {
  title: string;
  error: boolean;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <AdminModal
      title={title}
      onClose={onClose}
      footer={
        <UIButton tone="neutral" onClick={onClose}>
          Cerrar
        </UIButton>
      }
    >
      {error ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-dashed border-(--border) p-3 text-xs font-semibold text-(--muted)">
          No se pudieron cargar las voces.
          <button
            onClick={onRetry}
            className="rounded-lg border-2 border-(--accent) px-3 py-1.5 text-xs font-bold text-(--accent) transition-colors hover:bg-(--accent)/10"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-(--border) p-3 text-xs font-semibold text-(--muted)">
          Cargando voces…
        </div>
      )}
    </AdminModal>
  );
}
