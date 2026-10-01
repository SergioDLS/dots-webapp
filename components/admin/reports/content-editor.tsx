"use client";

import SentenceModal from "@/components/admin/sentence-modal";
import WordModal from "@/components/admin/word-modal";
import ReadingModal from "@/components/admin/reading-modal";
import { GrammarItemModal, GrammarPillModal } from "@/components/admin/foundations/grammar-manager";
import { VocabItemModal } from "@/components/admin/foundations/vocab-manager";
import { PronunciationItemModal, PronunciationUnitModal } from "@/components/admin/foundations/pronunciation-manager";
import { LetterItemModal } from "@/components/admin/foundations/letters-manager";
import { NumberItemModal } from "@/components/admin/foundations/numbers-manager";
import {
  setReadingEnabled,
  setSentenceEnabled,
  updateGrammarItem,
  updateGrammarPill,
  updateLetterItem,
  updateNumberItem,
  updatePronunciationItem,
  updatePronunciationUnit,
  updateVocabItem,
  type AdminGrammarItem,
  type AdminGrammarPill,
  type AdminLetterItem,
  type AdminNumberItem,
  type AdminPronunciationItem,
  type AdminPronunciationUnit,
  type AdminReading,
  type AdminReportContent,
  type AdminSentence,
  type AdminVocabItem,
  type AdminWord,
} from "@/services/admin.service";

/**
 * «Editar» desde un reporte (spec 2026-10-01 §2.5): el mismo modal que se usa
 * en Levels y Foundations, con el contenido tal como está ahora.
 */
export default function ContentEditor({
  type,
  data,
  onClose,
  onSaved,
}: {
  type: string;
  data: AdminReportContent;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const parent = data.parentId ?? 0;
  const c = data.content;
  switch (type) {
    case "sentence":
      return <SentenceModal levelId={parent} sentence={c as unknown as AdminSentence} onClose={onClose} onSaved={onSaved} />;
    case "word":
      return <WordModal levelId={parent} word={c as unknown as AdminWord} onClose={onClose} onSaved={onSaved} />;
    case "reading":
      return <ReadingModal reading={c as unknown as AdminReading} onClose={onClose} onSaved={onSaved} />;
    case "vocab_item":
      return <VocabItemModal packId={parent} item={c as unknown as AdminVocabItem} onClose={onClose} onSaved={onSaved} />;
    case "grammar_item":
      return <GrammarItemModal pillId={parent} item={c as unknown as AdminGrammarItem} onClose={onClose} onSaved={onSaved} />;
    case "grammar_pill":
      return <GrammarPillModal pill={c as unknown as AdminGrammarPill} onClose={onClose} onSaved={onSaved} />;
    case "pronunciation_item":
      return <PronunciationItemModal unitId={parent} item={c as unknown as AdminPronunciationItem} onClose={onClose} onSaved={onSaved} />;
    case "pronunciation_unit":
      return <PronunciationUnitModal unit={c as unknown as AdminPronunciationUnit} onClose={onClose} onSaved={onSaved} />;
    case "letter_item":
      return <LetterItemModal packId={parent} item={c as unknown as AdminLetterItem} onClose={onClose} onSaved={onSaved} />;
    case "number_item":
      return <NumberItemModal packId={parent} item={c as unknown as AdminNumberItem} onClose={onClose} onSaved={onSaved} />;
    default:
      return null;
  }
}

/** Tipos con `enabled` (todos menos palabras y falsos amigos). */
export function tieneInterruptor(type: string, content: Record<string, unknown>): boolean {
  return type !== "word" && type !== "false_friend" && typeof content.enabled === "boolean";
}

export async function cambiarEncendido(type: string, id: number, enabled: boolean): Promise<void> {
  switch (type) {
    case "sentence": return void (await setSentenceEnabled(id, enabled));
    case "reading": return void (await setReadingEnabled(id, enabled));
    case "vocab_item": return void (await updateVocabItem(id, { enabled }));
    case "grammar_item": return void (await updateGrammarItem(id, { enabled }));
    case "grammar_pill": return void (await updateGrammarPill(id, { enabled }));
    case "pronunciation_item": return void (await updatePronunciationItem(id, { enabled }));
    case "pronunciation_unit": return void (await updatePronunciationUnit(id, { enabled }));
    case "letter_item": return void (await updateLetterItem(id, { enabled }));
    case "number_item": return void (await updateNumberItem(id, { enabled }));
  }
}
