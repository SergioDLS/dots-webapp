/**
 * Color estable por usuario para los vecinos del camino: el mismo id siempre
 * recibe el mismo color, así una persona es reconocible entre sesiones.
 *
 * Matices bien separados para que dos vecinos no se confundan, y saturados lo
 * suficiente para sobrevivir el color-mix contra --surface en modo oscuro.
 */
const PEER_COLORS = [
  "#e0409a", // rosa dots
  "#3b82f6", // azul
  "#22c55e", // verde
  "#f59e0b", // ámbar
  "#8b5cf6", // violeta
  "#ef4444", // rojo
  "#14b8a6", // turquesa
  "#f97316", // naranja
] as const;

export function peerColor(userId: number): string {
  return PEER_COLORS[Math.abs(userId) % PEER_COLORS.length];
}
