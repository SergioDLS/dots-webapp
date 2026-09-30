// Reordenar arrastrando en la bandeja de «¡Arma la oración!».
// Puro (sin DOM): recibe las cajas de los chips tal como estaban al empezar
// el arrastre, en orden y relativas a la bandeja, y el punto del dedo en esas
// mismas coordenadas.

export type Box = { left: number; top: number; width: number; height: number };
export type Caret = { x: number; y: number; h: number };

/** Mueve el elemento `from` a la posición `to` sin mutar `list`. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Filas del flex-wrap: chips consecutivos con el mismo `top`. */
function rowsOf(boxes: readonly Box[]): number[][] {
  const rows: number[][] = [];
  boxes.forEach((b, i) => {
    const row = rows[rows.length - 1];
    const first = row && boxes[row[0]];
    if (first && Math.abs(b.top - first.top) < first.height / 2) row.push(i);
    else rows.push([i]);
  });
  return rows;
}

/**
 * Índice final del chip `from` si se suelta en (x, y), y dónde pintar el caret
 * que lo anuncia. `caret` es null cuando soltar ahí lo deja donde estaba.
 */
export function dropTarget(
  boxes: readonly Box[],
  from: number,
  x: number,
  y: number,
): { to: number; caret: Caret | null } {
  if (boxes.length === 0) return { to: from, caret: null };

  // Fila bajo el dedo; fuera de todas, la más cercana en vertical.
  const distance = (row: number[]) => {
    const { top, height } = boxes[row[0]];
    return y < top ? top - y : y > top + height ? y - top - height : 0;
  };
  const row = rowsOf(boxes).reduce((best, r) => (distance(r) < distance(best) ? r : best));

  // Se inserta antes del primer chip cuya mitad quede a la derecha del dedo.
  const before = row.find((i) => boxes[i].left + boxes[i].width / 2 > x);
  const slot = before ?? row[row.length - 1] + 1;
  const to = slot > from ? slot - 1 : slot;
  if (to === from) return { to, caret: null };

  const ref = boxes[before ?? row[row.length - 1]];
  let cx: number;
  if (before === undefined) cx = ref.left + ref.width + 4;
  else if (before !== row[0]) {
    const prev = boxes[before - 1];
    cx = (prev.left + prev.width + ref.left) / 2;
  } else cx = ref.left - 4;
  return { to, caret: { x: cx, y: ref.top, h: ref.height } };
}
