// Las entradas de ICON_PATHS en components/ui/icon/paths.tsx, una por icono.
// Va en un módulo aparte para poder probarlo sin leer archivos ni salir del
// proceso; lo usan check-icons.mjs y contact-sheet-icons.mjs.
//
// Una clave con guion no es un identificador de JS y va entre comillas por
// fuerza ("anadir-inicio"): la regex ya admitía el guion, pero no la comilla
// que el guion obliga a poner, y esos iconos quedaban fuera del recuento, de
// la regla de «icono antes de toda marca» y de la hoja de contacto. La comilla
// puede ser simple o doble, y `\1` exige que cierre la misma que abrió.
const ENTRADA_RE = /^ {2}(["']?)([a-z][\w-]*)\1: \(/gm;

/** @returns {{ nombre: string, index: number }[]} */
export function iconosDe(source) {
  return [...source.matchAll(ENTRADA_RE)].map((m) => ({ nombre: m[2], index: m.index }));
}
