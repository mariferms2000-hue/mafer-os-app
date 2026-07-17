"use client";

import { useEffect, useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/** Registra el service worker (solo en producción) y muestra el estado de conexión. */
export function PwaSetup() {
  const offline = useSyncExternalStore(
    subscribeOnline,
    () => !navigator.onLine,
    () => false
  );

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  if (!offline) return null;
  return (
    <p
      role="status"
      className="fixed top-2 left-1/2 -translate-x-1/2 z-[60] chip chip-waiting !py-1.5 !px-3 shadow-lift"
    >
      <WifiOff size={12} aria-hidden /> Sin conexión — tus cambios necesitan internet
    </p>
  );
}
