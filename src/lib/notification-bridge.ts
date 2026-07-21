/* Puente delgado hacia las APIs reales del navegador (Notification,
   localStorage). Toda decisión de negocio — copy, cuándo avisar, dedupe —
   vive en focus-notifications.ts (puro, con pruebas unitarias); aquí solo se
   llaman las APIs del navegador, con guardas para que nunca truene en el
   servidor ni en navegadores sin soporte. */

import {
  buildNotificationPayload,
  systemNotificationOptions,
  dedupKey,
  markNotified,
  wasNotified,
  type NotificationIntent,
} from "./focus-notifications";

const DEDUP_STORAGE_KEY = "mafer-os:focus-notif-sent";
const INVITE_DISMISSED_KEY = "mafer-os:focus-notif-invite-dismissed";

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function readPermission(): NotificationPermission | null {
  return notificationsSupported() ? Notification.permission : null;
}

/** Snapshot en un solo primitivo (para useSyncExternalStore — nunca objetos
 *  literales nuevos en cada llamada, o React entraría en un bucle de
 *  re-render). "unsupported" cuando la API ni siquiera existe. */
export type PermissionSnapshot = "unsupported" | NotificationPermission;

export function permissionSnapshot(): PermissionSnapshot {
  return notificationsSupported() ? Notification.permission : "unsupported";
}

export function permissionServerSnapshot(): PermissionSnapshot {
  return "unsupported"; // en el servidor no hay navegador — nunca se usa para decidir nada, solo evita el desajuste de hidratación
}

const CHANGE_EVENT = "mafer-os:focus-notif-change";

function announceChange() {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** No existe un evento nativo de "cambió el permiso"; escuchamos nuestro
 *  propio aviso (tras pedir permiso o descartar la invitación, igual que
 *  applyTheme/mafer-theme-change) más los momentos en que pudo cambiar desde
 *  fuera (volver de los ajustes del sistema, u otra pestaña vía storage).
 *  Pensado para useSyncExternalStore. */
export function subscribeNotificationState(cb: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, cb);
  window.addEventListener("focus", cb);
  document.addEventListener("visibilitychange", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CHANGE_EVENT, cb);
    window.removeEventListener("focus", cb);
    document.removeEventListener("visibilitychange", cb);
    window.removeEventListener("storage", cb);
  };
}

/** Solo debe llamarse desde un manejador de clic explícito (botón
 *  «Activar») — nunca automáticamente al cargar una vista. */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return "denied";
  const result = await Notification.requestPermission();
  announceChange();
  return result;
}

function readDedupKeys(): string[] {
  try {
    const raw = localStorage.getItem(DEDUP_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveDedupKeys(keys: string[]) {
  try {
    localStorage.setItem(DEDUP_STORAGE_KEY, JSON.stringify(keys));
  } catch {
    // Storage no disponible (privado/cuota) — el peor caso es un aviso de
    // menos tras una recarga muy específica, nunca un aviso de más.
  }
}

/** Dispara el aviso del sistema si el permiso está concedido y esta fase
 *  concreta no se avisó ya (protege contra recargas o montajes dobles).
 *  Devuelve true si de verdad se disparó. */
export function fireFocusNotification(
  intent: NotificationIntent,
  dedup: { sessionId: string; phaseStartedAt: string }
): boolean {
  if (!notificationsSupported() || Notification.permission !== "granted") return false;
  const key = dedupKey(dedup.sessionId, intent.kind, dedup.phaseStartedAt);
  const sent = readDedupKeys();
  if (wasNotified(sent, key)) return false;
  const { title, body } = buildNotificationPayload(intent);
  try {
    // systemNotificationOptions fija silent:false (sonido predeterminado del
    // sistema) y el tag deduplica también a nivel de sistema operativo.
    const n = new Notification(title, systemNotificationOptions(body, key));
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // Algún navegador puede rechazar la construcción fuera de ciertos
    // contextos; si falla, no interrumpimos el Pomodoro por esto.
    return false;
  }
  saveDedupKeys(markNotified(sent, key));
  return true;
}

/** Notificación genérica de prueba desde Ajustes — no representa una sesión
 *  real, así que no pasa por el dedupe de sesión. */
export function fireTestNotification(): boolean {
  if (!notificationsSupported() || Notification.permission !== "granted") return false;
  try {
    const n = new Notification(
      "Notificación de prueba — Mafer OS",
      systemNotificationOptions("Así se verán tus avisos del Jardín de enfoque.")
    );
    n.onclick = () => {
      window.focus();
      n.close();
    };
    return true;
  } catch {
    return false;
  }
}

export function inviteWasDismissed(): boolean {
  try {
    return localStorage.getItem(INVITE_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Snapshot primitivo para useSyncExternalStore — ver permissionSnapshot. */
export function inviteDismissedSnapshot(): "sí" | "no" {
  return inviteWasDismissed() ? "sí" : "no";
}

export function inviteDismissedServerSnapshot(): "sí" | "no" {
  return "no";
}

export function dismissInvite() {
  try {
    localStorage.setItem(INVITE_DISMISSED_KEY, "1");
  } catch {
    // Sin storage, la invitación podría reaparecer — molesto pero inofensivo.
  }
  announceChange();
}
