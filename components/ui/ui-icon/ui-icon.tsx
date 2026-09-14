import NextImage from "next/image";

// Solo existe para derivar el tipo de abajo por `typeof`; el componente usa
// `name` directamente en la ruta del PNG y no itera el arreglo.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const NOMBRES = [
  "gemas", "racha", "vidas", "xp", "corona", "trofeo",
  "medalla", "regalo", "podio-oro", "podio-plata", "podio-bronce", "rayo",
] as const;

export type UiIconName = (typeof NOMBRES)[number];

interface Props {
  name: UiIconName;
  /** Lado en px. 24 en la cabecera, 40 en los paneles de premio. */
  size?: number;
  /** Vida perdida, logro sin desbloquear: el mismo objeto, apagado. */
  apagado?: boolean;
  className?: string;
}

/**
 * Los iconos cuyo color es identidad y no estado: una gema es cyan, una racha
 * es fuego. Por eso son PNG y no entran en el set SVG, que se tiñe con el
 * contexto.
 *
 * No pasan por <Doty> ni por poses.ts: un icono no es una pose. Ese fue el
 * error de los seis de la fase 1, que acabaron en el registro de poses y no
 * los renderizó nadie.
 */
export default function UiIcon({ name, size = 24, apagado = false, className }: Props) {
  return (
    <NextImage
      src={`/images/ui/${name}.png`}
      alt=""
      width={size}
      height={size}
      aria-hidden
      className={className}
      style={apagado ? { filter: "grayscale(1)", opacity: 0.4 } : undefined}
    />
  );
}
