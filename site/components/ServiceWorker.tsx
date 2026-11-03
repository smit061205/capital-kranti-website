"use client";
// Starts public/sw.js (the website offline and as an app); only on the real
// site, never while developing, so a stale copy never hides a change.
import { useEffect } from "react";

export default function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      // one left by a production preview on this same address (3 Nov: it kept serving the old styles to the
      // development site, so the menu showed open and unstyled): taken off, with what it kept
      navigator.serviceWorker.getRegistrations().then(async (regs) => {
        if (!regs.length) return;
        await Promise.all(regs.map((r) => r.unregister()));
        for (const k of await caches.keys()) await caches.delete(k);
        location.reload();
      }).catch(() => {});
      return;
    }
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);
  return null;
}
