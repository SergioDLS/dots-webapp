import type { DotyPose } from "@/components/ui/doty/doty";

/**
 * Pistas contextuales (spec §7.3): lo único que hace falta entender de cada
 * pestaña, dicho una sola vez.
 *
 * Lógica pura para poder probarse con `node --test`: por eso SOLO admite
 * `import type` — Node ejecuta este archivo sin bundler y no resolvería `@/`.
 */
export type TipKey =
  | "camino.primer-nivel"
  | "camino.racha"
  | "arcade.diarios"
  | "repaso.que-es"
  | "retos.torneo"
  | "perfil.avatar";

export interface Tip {
  key: TipKey;
  /** Ruta EXACTA de la pestaña que la enseña. */
  ruta: string;
  pose: DotyPose;
  titulo: string;
  frase: string;
}

/** Como mucho dos por pestaña, y solo en la primera visita (spec §7.3). */
export const MAX_POR_PANTALLA = 2;

/**
 * El orden es el orden en que se enseñan.
 *
 * Las dos del Camino son literales del spec y de la tabla de voz de
 * docs/brand/doty-identity.md, donde el `·` separa título de frase. Las otras
 * cuatro se escribieron siguiendo las cinco reglas de voz del spec §2.2.
 *
 * `arcade.trono` NO está: el subproyecto C retiró el trono y su corona, así que
 * esa pista se quedó sin objetivo al que apuntar.
 */
export const TIPS: readonly Tip[] = [
  {
    key: "camino.primer-nivel",
    ruta: "/levels",
    pose: "senalando",
    titulo: "Este es tu primer nivel",
    frase: "Toca la imagen y arrancamos. Cada lección son unos tres minutos.",
  },
  {
    key: "camino.racha",
    ruta: "/levels",
    pose: "emocionado",
    titulo: "La llama es tu racha",
    frase: "Practica hoy y se enciende. Un día sin practicar y se apaga. Drama garantizado.",
  },
  {
    key: "arcade.diarios",
    ruta: "/play",
    pose: "gamer",
    titulo: "Dos juegos cada día",
    frase: "Cambian mañana. Juégalos y súmate XP en un minuto.",
  },
  {
    key: "repaso.que-es",
    ruta: "/review",
    pose: "meditando",
    titulo: "Aquí vuelve lo que aprendiste",
    frase: "Justo antes de que se te olvide. Dos minutos hoy te ahorran una lección mañana.",
  },
  {
    key: "retos.torneo",
    ruta: "/quests",
    pose: "emocionado",
    titulo: "Un torneo cada semana",
    frase: "Un juego distinto y una tabla para todos. Juega una vez y ya estás dentro.",
  },
  {
    key: "perfil.avatar",
    ruta: "/profile",
    pose: "senalando",
    titulo: "Esta es tu cara",
    frase: "Sale en el ranking y en el Camino. Tócala para ver tu gesto; el lápiz la cambia.",
  },
];

/**
 * Las pistas de esta pantalla que todavía no se han visto, en orden.
 *
 * `vistas` viene de `settings.tips_seen`, que en el servidor es una lista libre
 * y puede traer claves de versiones anteriores: las desconocidas se ignoran
 * solas, porque solo se usa para descartar.
 */
export function pendientesPara(pathname: string, vistas: readonly string[]): Tip[] {
  const ya = new Set(vistas);
  return TIPS.filter((t) => t.ruta === pathname && !ya.has(t.key)).slice(0, MAX_POR_PANTALLA);
}
