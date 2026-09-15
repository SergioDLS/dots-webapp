/**
 * URL de una imagen de contenido. Absolutas (Cloudinary) y rutas servidas por el
 * frontend (`/images/levels/x.png`) van tal cual; un nombre suelto (`abc.png`) es
 * el formato legacy de la tabla `words` y se resuelve contra `base`.
 */
export function wordImageUrl(src: string, base: string): string {
  if (/^https?:\/\//.test(src) || src.startsWith("/")) return src;
  return `${base}/words/${src}`;
}
