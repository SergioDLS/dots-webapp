import { ICON_PATHS, type IconName } from "./paths";

interface Props {
  name: IconName;
  /** Lado en px. El viewBox es siempre 48; esto solo escala. */
  size?: number;
  className?: string;
  /**
   * Silueta monocroma: todo el icono se pinta en `currentColor` (fills y
   * strokes de marca incluidos) en vez de la paleta cerrada de `paths.tsx`.
   * Para cuando el icono va sobre un fondo arbitrario que no controla esta
   * familia —p. ej. el disco de dificultad del Camino, que cambia de color
   * con el nivel— y los rellenos fijos (rosa/azul/cyan) no pueden garantizar
   * contraste. El contenedor decide el color con CSS `color`; a ese tamaño
   * conviene además una silueta sólida: no depende del grosor de trazo,
   * que a 12-13 px ya es submétrico.
   */
  mono?: boolean;
}

/**
 * Pinta un icono del set. Es la ÚNICA costura entre las pantallas y el SVG
 * DE ICONOGRAFÍA: el día que haya app React Native, este archivo se
 * reescribe con `react-native-svg` y ninguna pantalla que use `<Icon>`
 * cambia. Por eso esas pantallas nunca llevan un `<svg>` de icono suelto.
 *
 * No es la única costura SVG del repo: quedan gráficos preexistentes que no
 * son iconografía sino decoración estructural (hot-air-balloon.tsx,
 * path-section.tsx, sound.tsx). Quien porte a RN tiene que
 * localizarlos aparte; este componente no los cubre.
 */
export default function Icon({ name, size = 24, className, mono = false }: Props) {
  const cls = mono ? `icon-mono${className ? ` ${className}` : ""}` : className;
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={cls}
      aria-hidden
      focusable="false"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}
