/* Aviso de fin de fase del Pomodoro — capa por encima de focus-sound.ts.
   Puede llamarse desde varios pollers a la vez (el overlay abierto y el
   vigía de fondo, ver focus-watcher.tsx): el dedupe por sesión+fase+inicio
   garantiza que nunca suene ni notifique dos veces, y que suene aunque
   solo uno de los dos esté activo en ese momento. */

import { playFocusChime, isFocusSoundMuted } from "./focus-sound";

const LAST_NOTIFIED_KEY = "mafer-os:focus-last-notified";

function dueKey(sessionId: string, phase: string, phaseStartedAt: string): string {
  return `${sessionId}:${phase}:${phaseStartedAt}`;
}

function alreadyNotified(key: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(LAST_NOTIFIED_KEY) === key;
  } catch {
    return false;
  }
}

function markNotified(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_NOTIFIED_KEY, key);
  } catch {
    // localStorage puede fallar (modo privado, cuota) — en el peor caso
    // se repite un aviso, nunca se pierde uno.
  }
}

/** Suena el chime (si no está silenciado) y dispara una notificación del
 *  sistema (si el permiso está concedido) para el fin de una fase de
 *  enfoque o descanso. Idempotente por (sessionId, phase, phaseStartedAt):
 *  llamarla varias veces para el mismo fin de fase solo avisa una vez.
 *
 *  La notificación del sistema NO depende del silenciador del chime: ese
 *  botón silencia el sonido dentro de la app, no el aviso de respaldo para
 *  cuando Mafer no está mirando la pantalla. Fuera del alcance: Safari en
 *  iOS no expone `Notification` a páginas/PWAs normales (solo Web Push con
 *  service worker), así que ahí este respaldo simplemente no aplica — el
 *  chime sigue sonando si la pestaña sigue viva y en primer plano. */
export function notifyFocusDue(
  sessionId: string,
  phase: "enfoque" | "descanso",
  phaseStartedAt: string,
  taskLabel: string
): void {
  const key = dueKey(sessionId, phase, phaseStartedAt);
  if (alreadyNotified(key)) return;
  markNotified(key);

  if (!isFocusSoundMuted()) playFocusChime();

  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      const title = phase === "enfoque" ? "Bloque de enfoque completo 🌿" : "Descanso terminado";
      const body =
        phase === "enfoque"
          ? `Terminaste tu bloque${taskLabel ? ` — ${taskLabel}` : ""}. Vuelve a Mafer OS.`
          : "Hora de volver al enfoque.";
      const n = new Notification(title, { body, icon: "/icons/icon-192.png", tag: "mafer-os-focus" });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    }
  } catch {
    // Notification puede fallar a mitad de sesión (permiso revocado, etc.)
    // — el chime ya sonó, no rompemos nada por esto.
  }
}

/** Pide el permiso de notificaciones, solo si nunca se preguntó. Debe
 *  llamarse desde un gesto explícito del usuario (empezar una sesión) —
 *  nunca al cargar una página al azar. No-op donde `Notification` no existe
 *  (iOS Safari en páginas/PWAs normales). */
export function requestFocusNotifyPermission(): void {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}
