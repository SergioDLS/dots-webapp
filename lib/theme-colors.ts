/**
 * Colores de tema (claro/oscuro) que hace falta conocer FUERA de CSS: el
 * manifest de la PWA (splash, barra de estado antes de que corra JS) y el
 * script anti-flash / theme-toggle que pintan la `<meta name="theme-color">`
 * real en caliente.
 *
 * Esto NO sustituye a `--background` en app/globals.css, que sigue siendo la
 * fuente de verdad del CSS — las custom properties no se pueden importar
 * desde TypeScript, así que hay dos fuentes y hay que cambiar ambas a mano.
 * Ver el comentario junto a `--background` en globals.css.
 */
export const THEME_COLORS = {
  light: "#fff7fb",
  dark: "#14122e",
} as const;
