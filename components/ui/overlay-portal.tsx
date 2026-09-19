"use client";

import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const sinSuscripcion = () => () => {};

/**
 * Saca un overlay al `<body>`, fuera del árbol donde se escribió.
 *
 * `position: fixed` y `z-50` NO bastan para quedar por encima de todo: el
 * `z-index` solo compite dentro del contexto de apilamiento más cercano, y
 * basta un ancestro que cree uno para que el overlay quede atrapado dentro.
 *
 * Es lo que pasaba con el aviso de salida de Memoria Relámpago: la barra
 * superior que lo contiene es un ítem flex con `z-10` —y a un ítem flex el
 * `z-index` le aplica aunque sea `static`, creando contexto—, así que el `z-50`
 * del aviso solo competía contra sus hermanos dentro de la barra. La rejilla de
 * cartas, otro ítem flex con el mismo `z-10` pero posterior en el DOM, ganaba
 * el desempate y se pintaba encima: Doty y las dos opciones quedaban detrás de
 * las 16 cartas.
 *
 * Subir el `z-index` no lo arregla —sigue atrapado— y quitarle el `z-10` a la
 * barra lo arregla solo hasta que alguien envuelva el botón en otra caja con
 * `z-index`. Colgando del `<body>` no hay ancestro que pueda atraparlo, y deja
 * de importar dónde se escriba el componente.
 *
 * `fixed` se posiciona respecto al viewport, no al padre, así que mudarlo al
 * `<body>` no mueve nada de sitio; y los eventos de React siguen burbujeando
 * por el árbol de componentes, no por el del DOM, así que los manejadores de
 * quien lo renderiza siguen funcionando.
 *
 * El guardia de montaje es obligatorio: `createPortal` necesita `document`, que
 * en el render del servidor no existe. Va con `useSyncExternalStore` —el mismo
 * patrón que el sorteo de pose del login y el id propio del ranking— porque es
 * el que React resuelve sin desajustar la hidratación.
 */
export default function OverlayPortal({ children }: { children: ReactNode }) {
  const montado = useSyncExternalStore(
    sinSuscripcion,
    () => true,
    () => false,
  );
  if (!montado) return null;
  return createPortal(children, document.body);
}
