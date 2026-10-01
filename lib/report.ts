/**
 * Reportes de ejercicios (spec 2026-10-01): qué se reporta, qué motivos salen
 * y qué viaja al servidor. Puro y sin React, para que `node --test` lo corra
 * tal cual. La hoja (components/report/) solo pinta.
 */

export const MOTIVOS = ["answer", "typo", "meaning", "audio", "image", "bug", "other"] as const;
export type ReportReason = (typeof MOTIVOS)[number];

export type ReportTargetType =
  | "sentence"
  | "word"
  | "vocab_item"
  | "grammar_item"
  | "grammar_pill"
  | "pronunciation_item"
  | "pronunciation_unit"
  | "letter_item"
  | "number_item"
  | "reading"
  | "false_friend";

export type ReportSurface =
  | "practice"
  | "lesson-grammar"
  | "lesson-pronunciation"
  | "lesson-vocab"
  | "lesson-letters"
  | "lesson-numbers"
  | "checkpoint"
  | "placement"
  | "review"
  | "reading"
  | "app"
  | `game:${string}`;

/** La foto: lo que el alumno tenía delante, por si el contenido cambia después. */
export type ReportSnapshot = {
  prompt: string;
  options?: string[];
  image?: string;
  audio?: string;
  meaning?: string;
};

type Contexto = Record<string, string | number>;

export type ReportTarget = {
  /** Identidad para elegir y fusionar: "sentence:12", o superficie:prompt sin ejercicio. */
  key: string;
  type: ReportTargetType | null;
  /** String siempre: sentences.id es bigint. */
  id: string | null;
  surface: ReportSurface;
  mode?: string;
  /** Lo que se lee en «¿Sobre cuál?». */
  label: string;
  snapshot: ReportSnapshot;
  answer?: string;
  expected?: string;
  /** null = la pantalla no revela si falló (checkpoint, placement, lecturas). */
  wasWrong: boolean | null;
  hasAudio: boolean;
  hasImage: boolean;
  context: Contexto;
};

type NuevoObjetivo = {
  type: ReportTargetType | null;
  id: string | number | null;
  surface: ReportSurface;
  mode?: string;
  label?: string;
  snapshot: ReportSnapshot;
  hasAudio?: boolean;
  hasImage?: boolean;
  context?: Contexto;
};

const recortar = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

export function objetivo(n: NuevoObjetivo): ReportTarget {
  // Validar id: debe ser un número (incluyendo negativos para false_friend).
  const idStr = String(n.id ?? "").trim();
  const id = /^-?\d+$/.test(idStr) ? idStr : null;
  // Sin id no hay ejercicio que arreglar: cae en Bugs con «Algo no funciona» y
  // «Otra cosa», que es lo único que el servidor acepta sin objetivo.
  const type = id === null ? null : n.type;
  const prompt = String(n.snapshot.prompt ?? "").trim();
  return {
    key: type && id !== null ? `${type}:${id}` : `${n.surface}:${prompt}`,
    type,
    id,
    surface: n.surface,
    mode: n.mode,
    label: recortar((n.label ?? prompt).trim(), 80),
    snapshot: { ...n.snapshot, prompt },
    wasWrong: null,
    hasAudio: n.hasAudio ?? Boolean(n.snapshot.audio),
    hasImage: n.hasImage ?? Boolean(n.snapshot.image),
    context: n.context ?? {},
  };
}

export function conRespuesta(
  t: ReportTarget,
  r: { answer: string; expected?: string; wasWrong: boolean | null },
): ReportTarget {
  return { ...t, answer: r.answer, expected: r.expected, wasWrong: r.wasWrong };
}

/** «El juego en general» o la pantalla de Ajustes: sin tipo, cae en la pestaña Bugs. */
export function objetivoGeneral(surface: ReportSurface, label: string): ReportTarget {
  return objetivo({ type: null, id: null, surface, label, snapshot: { prompt: label } });
}

export function candidatosDeReporte(
  actuales: readonly ReportTarget[],
  anterior: ReportTarget | null,
): ReportTarget[] {
  if (!anterior || actuales.some((t) => t.answer !== undefined)) return [...actuales];
  const gemelo = actuales.findIndex((t) => t.key === anterior.key);
  if (gemelo >= 0) return actuales.map((t, i) => (i === gemelo ? anterior : t));
  return [...actuales, anterior];
}

const FRASE_POR_TIPO: Partial<Record<ReportTargetType, string>> = {
  sentence: "La oración no se entiende",
  grammar_item: "La oración no se entiende",
  vocab_item: "La traducción no cuadra",
  false_friend: "La traducción no cuadra",
  grammar_pill: "La explicación no se entiende",
  pronunciation_unit: "La explicación no se entiende",
  reading: "La lectura no se entiende",
};

const ETIQUETAS: Record<ReportReason, string> = {
  answer: "Mi respuesta debería estar bien",
  typo: "Hay una falta de ortografía",
  meaning: "La oración no se entiende",
  audio: "El audio está mal",
  image: "La imagen no corresponde",
  bug: "Algo no funciona",
  other: "Otra cosa",
};

export function motivosPara(t: ReportTarget): ReportReason[] {
  if (t.type === null) return ["bug", "other"];
  const out: ReportReason[] = [];
  if (t.wasWrong === true && t.answer) out.push("answer");
  out.push("typo");
  if (FRASE_POR_TIPO[t.type]) out.push("meaning");
  if (t.hasAudio) out.push("audio");
  if (t.hasImage) out.push("image");
  out.push("bug", "other");
  return out;
}

export function etiquetaMotivo(m: ReportReason, t: ReportTarget): string {
  if (m !== "meaning" || !t.type) return ETIQUETAS[m];
  if (t.type === "reading" && t.mode === "quiz") return "La pregunta no se entiende";
  return FRASE_POR_TIPO[t.type] ?? ETIQUETAS.meaning;
}

export function detalleMotivo(m: ReportReason, t: ReportTarget): string | null {
  if (m === "answer" && t.answer) {
    return t.expected
      ? `Elegiste «${t.answer}» · esperábamos «${t.expected}»`
      : `Elegiste «${t.answer}»`;
  }
  if (m === "other") return "Cuéntanos qué pasó abajo";
  return null;
}

export const MAX_COMENTARIO = 500;

/** Chips de «¿Dónde pasó?» del reporte general de Ajustes. */
export const LUGARES_APP = [
  { clave: "camino", etiqueta: "Camino" },
  { clave: "repaso", etiqueta: "Repaso" },
  { clave: "retos", etiqueta: "Retos" },
  { clave: "juegos", etiqueta: "Juegos" },
  { clave: "perfil", etiqueta: "Perfil" },
  { clave: "tienda", etiqueta: "Tienda" },
  { clave: "otra", etiqueta: "Otra" },
] as const;

export type Borrador = { motivos: readonly ReportReason[]; comentario: string; lugar?: string };

export function validarBorrador(b: Borrador): string | null {
  if (b.motivos.length === 0) return "Marca al menos un motivo";
  if (b.motivos.includes("other") && b.comentario.trim() === "") {
    return "Cuéntanos qué pasó en «Otra cosa»";
  }
  if (b.comentario.length > MAX_COMENTARIO) {
    return `El comentario se pasa de ${MAX_COMENTARIO} caracteres`;
  }
  return null;
}

/** Cuerpo de POST /reports. */
export type CuerpoReporte = {
  surface: ReportSurface;
  mode?: string;
  targetType?: ReportTargetType;
  targetId?: string;
  reasons: ReportReason[];
  comment?: string;
  answer?: string;
  expected?: string;
  wasWrong?: boolean;
  snapshot: ReportSnapshot;
  context: Record<string, unknown>;
};

/** Ninguna foto pasa de los 4 KB que acepta el servidor (spec §3.2). */
export function recortarFoto(f: ReportSnapshot): ReportSnapshot {
  return {
    prompt: recortar(f.prompt, 1000),
    ...(f.options ? { options: f.options.slice(0, 8).map((o) => recortar(o, 150)) } : {}),
    ...(f.image ? { image: recortar(f.image, 400) } : {}),
    ...(f.audio ? { audio: recortar(f.audio, 400) } : {}),
    ...(f.meaning ? { meaning: recortar(f.meaning, 300) } : {}),
  };
}

export function cuerpoDelReporte(
  t: ReportTarget,
  b: Borrador,
  contexto: Record<string, unknown>,
): CuerpoReporte {
  const conObjetivo = t.type !== null && t.id !== null;
  return {
    surface: t.surface,
    ...(t.mode ? { mode: t.mode } : {}),
    ...(conObjetivo ? { targetType: t.type as ReportTargetType, targetId: t.id as string } : {}),
    reasons: MOTIVOS.filter((m) => b.motivos.includes(m) && motivosPara(t).includes(m)),
    ...(b.comentario.trim() ? { comment: b.comentario.trim() } : {}),
    ...(t.answer ? { answer: recortar(t.answer, 300) } : {}),
    ...(t.expected ? { expected: recortar(t.expected, 300) } : {}),
    ...(t.wasWrong !== null ? { wasWrong: t.wasWrong } : {}),
    snapshot: recortarFoto(t.snapshot),
    context: { ...t.context, ...contexto, ...(b.lugar ? { lugar: b.lugar } : {}) },
  };
}

/** Los ítems de una partida para el selector: sin repetir, la versión fallada gana y va primero. */
export function ordenarParaJuego(vistos: readonly ReportTarget[], max = 30): ReportTarget[] {
  const porClave = new Map<string, ReportTarget>();
  for (const t of vistos) {
    const previo = porClave.get(t.key);
    if (
      !previo ||
      (t.wasWrong === true && previo.wasWrong !== true) ||
      (previo.answer === undefined && t.answer !== undefined && previo.wasWrong !== true)
    ) {
      porClave.set(t.key, t);
    }
  }
  const lista = [...porClave.values()];
  return [...lista.filter((t) => t.wasWrong === true), ...lista.filter((t) => t.wasWrong !== true)].slice(0, max);
}

// ── Constructores por tipo de contenido ────────────────────────────────────

type Opcion = { word: string; correct: boolean };

export function objetivoDePractica(
  s: { id: string | number; text: string; img?: string; sentence_extension?: string; options: readonly Opcion[] },
  mode: string,
  levelId: string | number,
): ReportTarget {
  const correcta = s.options.find((o) => o.correct)?.word ?? "";
  return objetivo({
    type: "sentence",
    id: s.id,
    surface: "practice",
    mode,
    snapshot: {
      prompt: mode === "witchIs" ? `Which is: ${correcta}?` : s.text,
      ...(mode === "buildUp" ? {} : { options: s.options.map((o) => o.word) }),
      ...(mode === "guessImg" && s.img ? { image: s.img } : {}),
    },
    hasAudio: Boolean(s.sentence_extension),
    hasImage: mode === "guessImg" || mode === "witchIs",
    context: { levelId: String(levelId) },
  });
}

export function esperadaDePractica(s: { text: string; options: readonly Opcion[] }, mode: string): string {
  return mode === "buildUp" ? s.text : (s.options.find((o) => o.correct)?.word ?? "");
}

export function objetivoDeOracion(
  s: { id: string | number; text: string; options?: readonly string[]; image?: string | null },
  surface: ReportSurface,
  extra: { mode?: string; hasAudio?: boolean; context?: Contexto } = {},
): ReportTarget {
  return objetivo({
    type: "sentence",
    id: s.id,
    surface,
    mode: extra.mode,
    snapshot: {
      prompt: s.text,
      ...(s.options ? { options: [...s.options] } : {}),
      ...(s.image ? { image: s.image } : {}),
    },
    hasAudio: extra.hasAudio ?? false,
    hasImage: Boolean(s.image),
    context: extra.context,
  });
}

export function objetivoDeGramatica(
  item: { id: number; text: string; options: readonly { word: string }[] },
  nodeId: number,
): ReportTarget {
  return objetivo({
    type: "grammar_item",
    id: item.id,
    surface: "lesson-grammar",
    mode: "practice",
    snapshot: { prompt: item.text, options: item.options.map((o) => o.word) },
    context: { nodeId },
  });
}

export function objetivoDePildora(
  p: { refId?: number | null; title: string; explanation: readonly { text: string }[] },
  nodeId: number,
): ReportTarget {
  return objetivo({
    type: p.refId ? "grammar_pill" : null,
    id: p.refId ?? null,
    surface: "lesson-grammar",
    mode: "explain",
    label: p.title,
    snapshot: { prompt: [p.title, ...p.explanation.map((b) => b.text)].join(" · ") },
    context: { nodeId },
  });
}

export function objetivoDePronunciacion(
  item: { id: number; audio?: string | null; options: readonly { word: string }[] },
  nodeId: number,
): ReportTarget {
  const palabras = item.options.map((o) => o.word);
  return objetivo({
    type: "pronunciation_item",
    id: item.id,
    surface: "lesson-pronunciation",
    mode: "drill",
    snapshot: { prompt: palabras.join(" / "), options: palabras, ...(item.audio ? { audio: item.audio } : {}) },
    hasAudio: true,
    context: { nodeId },
  });
}

export function objetivoDeUnidad(
  u: { refId?: number | null; title: string; descriptionEs?: string | null },
  nodeId: number,
): ReportTarget {
  return objetivo({
    type: u.refId ? "pronunciation_unit" : null,
    id: u.refId ?? null,
    surface: "lesson-pronunciation",
    mode: "intro",
    label: u.title,
    snapshot: { prompt: [u.title, u.descriptionEs].filter(Boolean).join(" · ") },
    context: { nodeId },
  });
}

export function objetivoDeVocab(
  item: { id: number; text: string; meaning: string; img?: string | null; audio?: string | null },
  surface: ReportSurface,
  mode: string,
  context: Contexto = {},
): ReportTarget {
  return objetivo({
    type: "vocab_item",
    id: item.id,
    surface,
    mode,
    label: `${item.text} · ${item.meaning}`,
    snapshot: {
      prompt: item.text,
      meaning: item.meaning,
      ...(item.img ? { image: item.img } : {}),
      ...(item.audio ? { audio: item.audio } : {}),
    },
    context,
  });
}

export function objetivoDeLetra(
  item: { id: number; letter: string; name?: string | null; exampleWord?: string | null; audio?: string | null },
  mode: string,
  nodeId: number,
): ReportTarget {
  return objetivo({
    type: "letter_item",
    id: item.id,
    surface: "lesson-letters",
    mode,
    label: item.letter,
    snapshot: {
      prompt: [item.letter, item.name, item.exampleWord].filter(Boolean).join(" · "),
      ...(item.audio ? { audio: item.audio } : {}),
    },
    context: { nodeId },
  });
}

export function objetivoDeNumero(
  item: { id: number; value: number; word: string; audio?: string | null },
  mode: string,
  nodeId: number,
): ReportTarget {
  return objetivo({
    type: "number_item",
    id: item.id,
    surface: "lesson-numbers",
    mode,
    label: `${item.value} · ${item.word}`,
    snapshot: { prompt: `${item.value} · ${item.word}`, ...(item.audio ? { audio: item.audio } : {}) },
    context: { nodeId },
  });
}

export function objetivoDeLectura(r: { id: number; title: string; text: string; src?: string | null }): ReportTarget {
  return objetivo({
    type: "reading",
    id: r.id,
    surface: "reading",
    mode: "read",
    label: `La lectura: ${r.title}`,
    snapshot: { prompt: `${r.title} — ${r.text}`, ...(r.src ? { audio: r.src } : {}) },
    hasAudio: Boolean(r.src),
    context: { readingId: r.id },
  });
}

export function objetivoDePregunta(
  r: { id: number; title: string },
  q: { idx: number; prompt: string; options: readonly string[] },
): ReportTarget {
  return {
    ...objetivo({
      type: "reading",
      id: r.id,
      surface: "reading",
      mode: "quiz",
      label: `Pregunta ${q.idx + 1}: ${q.prompt}`,
      snapshot: { prompt: q.prompt, options: [...q.options] },
      context: { readingId: r.id, idx: q.idx },
    }),
    // Misma lectura, otra pregunta: el selector necesita distinguirlas.
    key: `reading:${r.id}#${q.idx}`,
  };
}

export function objetivoDePalabra(w: { id: number; word: string; img?: string | null }, surface: ReportSurface): ReportTarget {
  return objetivo({
    type: "word",
    id: w.id,
    surface,
    label: w.word,
    snapshot: { prompt: w.word, ...(w.img ? { image: w.img } : {}) },
  });
}

/** ¿Verdad o Trampa?: las trampas de FALSE_FRIENDS traen id negativo y viven en el código. */
export function objetivoDeTarjeta(
  card: { id: number; en: string; es: string; realEs?: string | null },
  surface: ReportSurface,
): ReportTarget {
  return objetivo({
    type: card.id < 0 ? "false_friend" : "vocab_item",
    id: card.id,
    surface,
    mode: "true-false",
    label: `${card.en} = ${card.es}`,
    snapshot: { prompt: `${card.en} = ${card.es}`, ...(card.realEs ? { meaning: card.realEs } : {}) },
  });
}
