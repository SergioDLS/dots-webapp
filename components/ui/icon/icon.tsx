import { ICON_PATHS, type IconName } from "./paths";

interface Props {
  name: IconName;
  /** Lado en px. El viewBox es siempre 48; esto solo escala. */
  size?: number;
  className?: string;
}

/**
 * Pinta un icono del set. Es la ÚNICA costura entre las pantallas y el SVG
 * DE ICONOGRAFÍA: el día que haya app React Native, este archivo se
 * reescribe con `react-native-svg` y ninguna pantalla que use `<Icon>`
 * cambia. Por eso esas pantallas nunca llevan un `<svg>` de icono suelto.
 *
 * No es la única costura SVG del repo: quedan gráficos preexistentes que no
 * son iconografía sino decoración estructural (hot-air-balloon.tsx,
 * path-node.tsx, path-section.tsx, sound.tsx). Quien porte a RN tiene que
 * localizarlos aparte; este componente no los cubre.
 */
export default function Icon({ name, size = 24, className }: Props) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={className}
      aria-hidden
      focusable="false"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}
