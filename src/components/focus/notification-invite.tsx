"use client";

import { useState, useSyncExternalStore } from "react";
import { Bell } from "lucide-react";
import {
  requestNotificationPermission,
  dismissInvite,
  subscribeNotificationState,
  permissionSnapshot,
  permissionServerSnapshot,
  inviteDismissedSnapshot,
  inviteDismissedServerSnapshot,
} from "@/lib/notification-bridge";
import { deriveNotificationUiState } from "@/lib/focus-notifications";

/** Invitación discreta y contextual (Fase N1): vive en la pantalla de
 *  «Empezar» del Jardín de enfoque, nunca al iniciar sesión ni al abrir la
 *  app. El permiso del navegador solo se solicita al pulsar «Activar» — el
 *  único lugar del código donde se llama requestNotificationPermission()
 *  fuera de Ajustes. Si la usuaria elige «Ahora no» (o el navegador deniega),
 *  no se vuelve a insistir sola: sigue disponible manualmente en Ajustes.
 *  (useSyncExternalStore, mismo patrón que useThemePref, para leer estado
 *  del navegador sin el anti-patrón de setState dentro de un efecto.) */
export function NotificationInvite() {
  const permission = useSyncExternalStore(subscribeNotificationState, permissionSnapshot, permissionServerSnapshot);
  const dismissed = useSyncExternalStore(
    subscribeNotificationState,
    inviteDismissedSnapshot,
    inviteDismissedServerSnapshot
  );
  const [requesting, setRequesting] = useState(false);

  if (permission === "unsupported") return null;
  if (dismissed === "sí") return null;
  const state = deriveNotificationUiState(true, permission);
  if (state !== "no-configuradas") return null;

  return (
    <div
      className="w-full max-w-md rounded-xl border border-card-border bg-surface-hover px-4 py-3 flex items-center gap-3 text-left"
      data-testid="focus-notification-invite"
    >
      <Bell size={16} className="text-sage-deep shrink-0" aria-hidden />
      <p className="flex-1 text-sm text-stone">¿Quieres que Mafer OS te avise cuando termine?</p>
      <div className="flex gap-2 shrink-0">
        <button
          type="button"
          className="btn btn-secondary !py-1 !px-3 text-xs"
          disabled={requesting}
          onClick={async () => {
            setRequesting(true);
            await requestNotificationPermission();
            setRequesting(false);
            dismissInvite();
          }}
          data-testid="focus-notification-invite-activar"
        >
          Activar
        </button>
        <button
          type="button"
          className="btn btn-ghost !py-1 !px-3 text-xs"
          onClick={() => dismissInvite()}
          data-testid="focus-notification-invite-ahora-no"
        >
          Ahora no
        </button>
      </div>
    </div>
  );
}
