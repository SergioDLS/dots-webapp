import { isDotyPose, poseOrFallback, type DotyPose } from "@/components/ui/doty/doty";
import { narratorFallback } from "@/lib/path-view";

/**
 * Pose del narrador de una dificultad: la que trae el backend (`difficulty.img`)
 * si existe en el registro y su arte ya no es el placeholder; si no, el narrador
 * por posición (spec §2.3). Compartida por el banner, la cabecera plegada y la
 * tarjeta bloqueada.
 */
export function narratorPose(img: string | null | undefined, index: number): DotyPose {
  const fallback = narratorFallback(index);
  return isDotyPose(img) ? poseOrFallback(img, fallback) : fallback;
}
