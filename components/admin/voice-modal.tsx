"use client";

import React from "react";
import UIButton from "@/components/ui/button/button";
import { AdminModal } from "@/components/admin/ui";
import VoiceStudio, {
  type DraftOpts,
  type StudioTake,
} from "@/components/admin/voice-studio";
import type { AdminCharacter } from "@/services/admin.service";

interface VoiceModalProps {
  title: string;
  live: StudioTake | null;
  characters: AdminCharacter[];
  onDraft: (opts: DraftOpts) => Promise<StudioTake & { characterId: number }>;
  onPublish: (characterId: number) => Promise<{ urls: string[] }>;
  onClose: () => void;
}

/**
 * Envoltorio de modal para `VoiceStudio`.
 *
 * ⚠️ Hereda el requisito del studio: dale `key={item.id}` donde lo montes. El
 * studio siembra su estado interno desde `live`, así que reusar la instancia
 * entre dos ítems mostraría la toma del anterior.
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
    <AdminModal
      title={title}
      onClose={onClose}
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
