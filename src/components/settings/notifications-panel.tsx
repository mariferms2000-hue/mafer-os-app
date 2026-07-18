"use client";

import { useState, useSyncExternalStore } from "react";
import { Bell } from "lucide-react";
import {
  requestNotificationPermission,
  fireTestNotification,
  subscribeNotificationState,
  permissionSnapshot,
  permissionServerSnapshot,
} from "@/lib/notification-bridge";
import { deriveNotificationUiState, NOTIFICATION_UI_LABEL, detectPlatformHint, BLOCKED_HELP_TEXT } from "@/lib/focus-notifications";

/** Ajustes → «Notificaciones de enfoque» (Fase N1). El estado del permiso
 *  vive solo en el navegador (Notification.permission) — nada de esto toca
 *  la base de datos ni añade tablas. El permiso solo se pide al pulsar
 *  «Activar»; si el sistema ya lo bloqueó, no se reintenta solo — se muestra
 *  una instrucción breve y correcta para esta misma plataforma.
 *  (useSyncExternalStore, mismo patrón que useThemePref en theme.tsx.) */
export function NotificationsPanel() {
  const permission = useSyncExternalStore(subscribeNotificationState, permissionSnapshot, permissionServerSnapshot);
  const [requesting, setRequesting] = useState(false);
  const [testSent, setTestSent] = useState(false);

  const supported = permission !== "unsupported";
  const state = deriveNotificationUiState(supported, supported ? permission : null);
  // navigator solo existe tras el primer render en el cliente; en el server
  // "unsupported" ya hizo que las ramas que lo usan no se rendericen ahí.
  const platform = typeof navigator !== "undefined" ? detectPlatformHint(navigator.userAgent) : "otro";

  async function activar() {
    setRequesting(true);
    await requestNotificationPermission();
    setRequesting(false);
  }

  function enviarPrueba() {
    const ok = fireTestNotification();
    setTestSent(ok);
    if (ok) setTimeout(() => setTestSent(false), 3000);
  }

  return (
    <section className="card p-5 mb-5">
      <h2 className="section-eyebrow mb-2 flex items-center gap-2">
        <Bell size={13} className="text-sage-deep" aria-hidden /> Notificaciones de enfoque
      </h2>
      <p className="text-sm text-stone mb-3">Mafer OS puede avisarte cuando termine un bloque o descanso.</p>
      <p className="text-sm mb-3">
        Estado:{" "}
        <span className="chip chip-waiting" data-testid="notif-state">
          {NOTIFICATION_UI_LABEL[state]}
        </span>
      </p>

      {state === "no-configuradas" && (
        <button
          type="button"
          className="btn btn-primary"
          onClick={activar}
          disabled={requesting}
          data-testid="notif-activar"
        >
          {requesting ? "Solicitando…" : "Activar notificaciones"}
        </button>
      )}

      {state === "bloqueadas" && (
        <p className="text-xs text-stone-soft" data-testid="notif-blocked-help">
          {BLOCKED_HELP_TEXT[platform]}
        </p>
      )}

      {state === "no-compatible" && (
        <p className="text-xs text-stone-soft" data-testid="notif-unsupported">
          Este navegador o dispositivo no admite notificaciones locales todavía.
        </p>
      )}

      {state === "activadas" && (
        <div className="flex items-center gap-3">
          <button type="button" className="btn btn-secondary text-xs" onClick={enviarPrueba} data-testid="notif-test">
            Enviar notificación de prueba
          </button>
          {testSent && <span className="text-xs text-done">Enviada ✓</span>}
        </div>
      )}

      <p className="text-xs text-stone-soft mt-3">
        Por ahora funcionan mientras el Jardín de enfoque está abierto en una pestaña (visible o en segundo plano).
        Con la app completamente cerrada, los avisos llegarán más adelante con Web Push.
      </p>
    </section>
  );
}
