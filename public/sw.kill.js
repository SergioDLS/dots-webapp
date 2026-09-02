/* KILL-SWITCH — NO registrar en condiciones normales.
 *
 * Emergencia (sw.js roto en producción), UN solo commit:
 *   1. cp public/sw.kill.js public/sw.js
 *   2. Quitar <SwRegister /> de app/layout.tsx
 *   3. Commit + push → Vercel. Cada cliente queda limpio en su siguiente
 *      navegación (el header no-cache de /sw.js en next.config.ts lo baja a
 *      minutos; el cap duro del spec son 24 h).
 *
 * Sin client.navigate a propósito: mientras algún cliente conserve el
 * registro, navigate(client.url) provocaría un loop de reloads. Sin fetch
 * handler, todo pasa directo a red desde el claim — con eso basta.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n.startsWith("dots-")).map((n) => caches.delete(n)),
      );
      await self.clients.claim();
      await self.registration.unregister();
    })(),
  );
});
