import type { AdminReportAnswer } from "@/services/admin.service";

/**
 * Vista de la bandeja de reportes del admin (spec 2026-10-01 §2): etiquetas,
 * recuentos y qué se puede aceptar. Puro, bajo `node --test`.
 */

const MOTIVOS_ORDEN = ["answer", "typo", "meaning", "audio", "image", "bug", "other"] as const;

const ETIQUETA_MOTIVO: Record<string, string> = {
  answer: "debería estar bien",
  typo: "ortografía",
  meaning: "no se entiende",
  audio: "audio",
  image: "imagen",
  bug: "no funciona",
  other: "otra cosa",
};

export const ETIQUETA_TIPO: Record<string, string> = {
  sentence: "Oración",
  word: "Palabra",
  vocab_item: "Vocabulario",
  grammar_item: "Gramática",
  grammar_pill: "Píldora de gramática",
  pronunciation_item: "Pronunciación",
  pronunciation_unit: "Unidad de pronunciación",
  letter_item: "Letra",
  number_item: "Número",
  reading: "Lectura",
  false_friend: "Falso amigo",
};

const SUPERFICIES: Record<string, string> = {
  practice: "Práctica",
  "lesson-grammar": "Gramática",
  "lesson-pronunciation": "Pronunciación",
  "lesson-vocab": "Vocabulario",
  "lesson-letters": "Letras",
  "lesson-numbers": "Números",
  checkpoint: "Checkpoint",
  placement: "Prueba de nivel",
  review: "Repaso",
  reading: "Lectura",
  app: "Ajustes",
};

const JUEGOS: Record<string, string> = {
  "true-false": "¿Verdad o Trampa?",
  "dot-match": "Dot Match",
  memory: "Memoria Relámpago",
  "audio-blitz": "Escucha Rápida",
  "word-tower": "Torre de Palabras",
  "sentence-builder": "Constructor",
  wordle: "Palabra del Día",
  crossword: "Mini Crucigrama",
  "ghost-race": "Carrera Fantasma",
  "dot-bombs": "Dot Bombs",
  "dont-pop": "¡No lo revientes!",
  dotaxi: "Dotaxi",
};

export function etiquetaSuperficie(surface: string): string {
  if (surface.startsWith("game:")) {
    const key = surface.slice(5);
    return `Juego · ${JUEGOS[key] ?? key}`;
  }
  return SUPERFICIES[surface] ?? surface;
}

export function etiquetaMotivoAdmin(m: string): string {
  return ETIQUETA_MOTIVO[m] ?? m;
}

export function resumenMotivos(reasons: Record<string, number>): string {
  return MOTIVOS_ORDEN.filter((m) => (reasons[m] ?? 0) > 0)
    .map((m) => `${reasons[m]} ${ETIQUETA_MOTIVO[m]}`)
    .join(" · ");
}

export function puedeAceptar(type: string): boolean {
  return type === "sentence" || type === "grammar_item";
}

export function alternativaPara(
  type: string,
  respuesta: Pick<AdminReportAnswer, "kind">,
): { targetType: "sentence" | "grammar_item"; kind: "word" | "sentence" } | null {
  if (type === "sentence") return { targetType: "sentence", kind: respuesta.kind };
  if (type === "grammar_item" && respuesta.kind === "word") return { targetType: "grammar_item", kind: "word" };
  return null;
}

export function notaPorDefecto(answer: string): string {
  return `Ahora «${answer}» también vale`;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function fechaCorta(iso: string, ahora: Date = new Date()): string {
  const d = new Date(iso);
  const dia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dias = Math.round((dia(ahora) - dia(d)) / 86_400_000);
  if (dias === 0) {
    return `hoy ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  if (dias === 1) return "ayer";
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
}

const CAMPOS: Record<string, Array<[string, string]>> = {
  sentence: [["text", "Oración"], ["mWord", "Palabra correcta"]],
  word: [["text", "Palabra"], ["meaning", "Significado"]],
  vocab_item: [["text", "Inglés"], ["meaning", "Significado"]],
  grammar_item: [["text", "Oración"], ["answer", "Respuesta"]],
  grammar_pill: [["title", "Título"]],
  pronunciation_item: [["wordA", "Palabra A"], ["wordB", "Palabra B"]],
  pronunciation_unit: [["title", "Título"], ["descriptionEs", "Descripción"]],
  letter_item: [["letter", "Letra"], ["name", "Nombre"], ["exampleWord", "Ejemplo"], ["exampleMeaning", "Significado"]],
  number_item: [["value", "Número"], ["word", "En inglés"]],
  reading: [["title", "Título"], ["text", "Texto"]],
};

/** Lo que se enseña del contenido actual en el detalle, sin campos vacíos. */
export function camposVisibles(type: string, content: Record<string, unknown>): Array<{ label: string; value: string }> {
  return (CAMPOS[type] ?? [])
    .map(([campo, label]) => ({ label, value: content[campo] == null ? "" : String(content[campo]) }))
    .filter((c) => c.value.trim() !== "");
}

export function idsPendientes(reports: ReadonlyArray<{ id: number; status: string }>): number[] {
  return reports.filter((r) => r.status === "pending").map((r) => r.id);
}

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/**
 * Lo que el servidor dijo al rechazar una acción del admin (cerrar, aceptar,
 * quitar), o `porDefecto` si no dijo nada utilizable. Los 400, 404, 409 y 503
 * del backend ya vienen en español y explican el porqué («El orden aceptado
 * debe usar las mismas fichas que la oración»). `message` es un texto, o un
 * arreglo de textos cuando lo rechaza el ValidationPipe de Nest, que se une
 * con « · ».
 *
 * Un 5xx que no sea 503 es el servidor (o su proxy) fallando: su texto no
 * explica nada al admin, así que cae al de por defecto, igual que un error que
 * no trae respuesta del servidor (red caída, fallo de nuestro código).
 */
export function mensajeDelServidor(err: unknown, porDefecto: string): string {
  if (!esObjeto(err) || !esObjeto(err.response)) return porDefecto;
  const { status, data } = err.response;
  if (typeof status === "number" && status >= 500 && status !== 503) return porDefecto;
  if (!esObjeto(data)) return porDefecto;
  const partes = (Array.isArray(data.message) ? data.message : [data.message])
    .filter((p): p is string => typeof p === "string")
    .map((p) => p.trim())
    .filter((p) => p !== "");
  return partes.length > 0 ? partes.join(" · ") : porDefecto;
}
