export type PoseEntryLike = { src: string };

/**
 * Una pose está "pendiente" si su PNG todavía es el placeholder del registro
 * (la cara de `feliz`): `--emit-registry` la apunta ahí mientras la pieza no esté
 * `done` en su catálogo. Puro y sin importar el registro para que se pruebe solo.
 */
export function isPlaceholderPose(
  registry: Record<string, PoseEntryLike>,
  pose: string,
  placeholderKey = "feliz",
): boolean {
  const entry = registry[pose];
  if (!entry || pose === placeholderKey) return false;
  return entry.src === registry[placeholderKey]?.src;
}

/** La pose nueva si ya tiene arte; si sigue en placeholder, el fallback del spec §2.3. */
export function resolvePoseOrFallback<T extends string>(
  registry: Record<string, PoseEntryLike>,
  pose: T,
  fallback: T,
): T {
  return isPlaceholderPose(registry, pose) ? fallback : pose;
}
