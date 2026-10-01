import { LUGARES_APP } from "./report.ts";
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

/**
 * El chip de «¿Dónde pasó?» del reporte de Ajustes (`context.lugar`) con su
 * etiqueta, la misma que ve el alumno. Una clave que la lista no conoce (otra
 * versión de la app) se ve tal cual.
 */
export function etiquetaLugar(clave: string): string {
  return LUGARES_APP.find((l) => l.clave === clave)?.etiqueta ?? clave;
}

/**
 * Los `mode` que la app manda de verdad —los literales de los constructores de
 * lib/report.ts y los que pasan las pantallas— con su título en español: el que
 * ve el alumno donde ya está en español («¡Arma la oración!», «¿Cómo suena?»)
 * y la traducción donde la pantalla lo dice en inglés («Complete the sentence!»).
 * Una clave puede cubrir cosas parecidas según la superficie (`match` es
 * emparejar tanto en vocabulario como en números y en Dot Match), por eso las
 * etiquetas son generales y la superficie va al lado.
 */
const ETIQUETA_MODO: Record<string, string> = {
  // Práctica: el servidor decide el modo de cada oración (sentences.service.ts).
  complete: "Completa la oración",
  buildUp: "Arma la oración",
  whatDoYouHear: "¿Qué escuchas?",
  whatDoYouHearSentence: "¿Qué oración escuchas?",
  guessImg: "¿Qué es esto?",
  witchIs: "¿Cuál es?",
  // Gramática y pronunciación.
  practice: "Ejercicio",
  explain: "Explicación",
  drill: "¿Qué palabra oíste?",
  intro: "Introducción",
  // Vocabulario, letras y números.
  present: "Presentación",
  listen: "Escucha y elige",
  direct: "Escucha y elige",
  inverse: "¿Cómo suena?",
  recognize: "¿Qué número es?",
  match: "Empareja",
  // Lecturas.
  read: "Texto",
  quiz: "Pregunta",
  // Juegos.
  order: "Ordena las fichas",
  "true-false": "Tarjeta",
  category: "Elige la categoría",
  image: "Palabra de la imagen",
};

/**
 * El modo con su título; el que no se conoce, tal cual. `mode` lo escribe el
 * alumno (hasta 40 letras), así que `hasOwn`: «constructor» no es un modo.
 */
export function etiquetaModo(mode: string): string {
  return Object.hasOwn(ETIQUETA_MODO, mode) ? ETIQUETA_MODO[mode] : mode;
}

/**
 * El «dónde» de un reporte (spec §2.4): «Práctica · Arma la oración»,
 * «Ajustes · Tienda». Superficie, modo, lugar de Ajustes y, al final, dónde
 * vive el ejercicio (nivel, pack, píldora…). Lo vacío o que no es texto no se pinta.
 */
export function dondeDelReporte(r: {
  surface: string;
  mode: string | null;
  where?: string | null;
  context: Record<string, unknown>;
}): string {
  const lugar = typeof r.context.lugar === "string" ? etiquetaLugar(r.context.lugar) : "";
  return [etiquetaSuperficie(r.surface), r.mode ? etiquetaModo(r.mode) : "", lugar, r.where ?? ""]
    .filter((parte) => parte !== "")
    .join(" · ");
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

/**
 * Lo que «Arreglado» / «Descartar» cierra: lo marcado que SIGUE pendiente en la
 * última lectura. `marcados` sobrevive a las relecturas en el sitio (aceptar,
 * quitar, apagar, editar) y otro admin pudo cerrar uno entre medias: ese id ni
 * se manda ni cuenta en el botón. `null` = el admin no ha tocado las casillas,
 * así que son todos los pendientes; `[]` = los desmarcó a propósito, ninguno.
 */
export function idsACerrar(marcados: readonly number[] | null, pendientes: readonly number[]): number[] {
  return (marcados ?? pendientes).filter((id) => pendientes.includes(id));
}

/**
 * ¿Se puede abrir en un editor el ejercicio de un reporte? Todo el que tenga
 * ejercicio salvo el falso amigo, que vive fijo en el código (FALSE_FRIENDS en
 * games.service.ts) y no tiene contenido que editar. Un reporte sin ejercicio
 * (un bug general) tampoco tiene nada que abrir.
 */
export function esEditable(type: string | null, id: string | null): boolean {
  return Boolean(type) && Boolean(id) && type !== "false_friend";
}

/**
 * Qué hace el modal de edición tras «Guardar» cuando se abre desde la bandeja:
 * se cierra, salvo el de la oración. Ese sigue abierto, como en Levels, porque
 * el backend re-narra al guardar y el studio de voz que lleva dentro es donde
 * se escucha (y se avisa «La narración NO se pudo generar — revísala abajo»).
 */
export function cierraAlGuardar(type: string): boolean {
  return type !== "sentence";
}

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/**
 * Los únicos estados cuyo `message` escribe el backend en español y explica el
 * porqué: 400 (validación y reglas de las alternativas), 404, 409 (otro admin
 * se adelantó) y 503 (migración sin aplicar). Con los demás no se muestra lo
 * que diga el servidor: los 401 y 403 de Nest vienen en inglés («Unauthorized»,
 * «Forbidden resource») y los 5xx son el servidor o su proxy fallando.
 */
const ESTADOS_QUE_EXPLICAN: readonly number[] = [400, 404, 409, 503];

/**
 * Lo que el servidor dijo al rechazar una acción del admin (cerrar, aceptar,
 * quitar, abrir un ejercicio), o `porDefecto` si no dijo nada utilizable.
 * `message` es un texto, o un arreglo de textos cuando lo rechaza el
 * ValidationPipe de Nest, que se une con « · » («El orden aceptado debe usar
 * las mismas fichas que la oración»).
 *
 * Solo se fía del texto en `ESTADOS_QUE_EXPLICAN`. Un error sin respuesta del
 * servidor (red caída, fallo de nuestro código) o con un cuerpo que no es un
 * objeto con mensaje (el HTML de un proxy) también cae al de por defecto.
 */
export function mensajeDelServidor(err: unknown, porDefecto: string): string {
  if (!esObjeto(err) || !esObjeto(err.response)) return porDefecto;
  const { status, data } = err.response;
  if (typeof status !== "number" || !ESTADOS_QUE_EXPLICAN.includes(status)) return porDefecto;
  if (!esObjeto(data)) return porDefecto;
  const partes = (Array.isArray(data.message) ? data.message : [data.message])
    .filter((p): p is string => typeof p === "string")
    .map((p) => p.trim())
    .filter((p) => p !== "");
  return partes.length > 0 ? partes.join(" · ") : porDefecto;
}
