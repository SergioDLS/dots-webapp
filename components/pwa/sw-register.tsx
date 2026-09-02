"use client";

import { useEffect } from "react";

/**
 * Registra /sw.js solo en producción. En dev DESREGISTRA activamente: si
 * probaste un build local con `next start` en :3000, el SW quedaría
 * controlando el dev server del mismo origen y sirviendo assets stale.
 *
 * updateViaCache: "none" + el header no-cache de next.config.ts hacen que
 * un sw.js nuevo (o el kill-switch, ver public/sw.kill.js) se detecte en la
 * siguiente navegación.
 */
export default function SwRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {});
      return;
    }
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .catch(() => {});
  }, []);
  return null;
}
