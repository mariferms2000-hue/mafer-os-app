/* Fase N1 — Notificaciones locales del Pomodoro: lógica pura, sin DOM.
   Todo lo que decide QUÉ decir y CUÁNDO avisar vive aquí y es testeable con
   Vitest normal (sin jsdom). El único código que toca `Notification`,
   `localStorage` o `navigator` vive en notification-bridge.ts — un puente
   delgado que solo llama estas funciones.

   Regla central de la fase: un aviso solo tiene sentido cuando el bloque o el
   descanso terminan MIENTRAS la app puede ejecutar código (el reloj llegó a
   cero en tiempo real). Nunca se dispara por pausar, terminar antes, saltar
   el descanso o descartar — esas son decisiones explícitas de la usuaria, que
   ya está mirando la pantalla. Tampoco se dispara al recuperar una sesión
   tras reabrir la app (eso se muestra honestamente DENTRO de la app, nunca
   fingiendo un aviso a tiempo que no llegó). */

// ── Copy (español, tono sereno, sin culpa ni urgencia) ──────────────

export type NotificationCopy = { title: string; body: string };

export function focusEndCopy(input: { minutes: number; taskTitle: string | null }): NotificationCopy {
  const title = "Tu bloque de enfoque terminó";
  const body = input.taskTitle
    ? `Terminaste ${input.minutes} minutos en ${input.taskTitle}. Tu planta sigue creciendo.`
    : `Terminaste ${input.minutes} minutos de enfoque. Tu planta sigue creciendo.`;
  return { title, body };
}

/** Copy aprobado para «inicio del descanso» — se conserva y se prueba, pero
 *  no se dispara automáticamente en esta fase: en la UI actual el descanso
 *  SIEMPRE lo empieza la propia usuaria con un clic («Descansar N min» en el
 *  bloque completo); en ese instante ya está mirando la pantalla, así que un
 *  aviso del sistema sería un duplicado de algo que ella misma acaba de
 *  iniciar. Ver intentForAutomaticAction: «empezar-descanso» no es una
 *  acción automática y por eso no puede producir un NotificationIntent. */
export function breakStartCopy(input: { minutes: number }): NotificationCopy {
  return {
    title: "Es momento de descansar",
    body: `Tienes ${input.minutes} minutos para respirar antes del siguiente bloque.`,
  };
}

export function breakEndCopy(): NotificationCopy {
  return {
    title: "Tu descanso terminó",
    body: "Puedes comenzar otro bloque cuando estés lista.",
  };
}

// ── Qué avisar, a partir de una transición automática ───────────────

export type NotificationIntent =
  | { kind: "focus-end"; minutes: number; taskTitle: string | null }
  | { kind: "break-end" };

/** Las dos únicas transiciones que el motor dispara SOLO cuando el reloj
 *  llega a cero en tiempo real (nunca por un clic). Ver focus-logic.ts:
 *  transition() — el resto de acciones (pausar, reanudar, terminar-antes,
 *  empezar-descanso, saltar-descanso) son siempre decisiones explícitas. */
export type AutomaticFocusAction = "completar-enfoque" | "terminar-descanso";

export function intentForAutomaticAction(
  action: AutomaticFocusAction,
  ctx: { minutes: number; taskTitle: string | null }
): NotificationIntent {
  return action === "completar-enfoque"
    ? { kind: "focus-end", minutes: ctx.minutes, taskTitle: ctx.taskTitle }
    : { kind: "break-end" };
}

export function buildNotificationPayload(intent: NotificationIntent): NotificationCopy {
  return intent.kind === "focus-end" ? focusEndCopy(intent) : breakEndCopy();
}

// ── Opciones del sistema (sonido incluido) ──────────────────────────

/** Opciones comunes de TODA notificación del Pomodoro (reales y de prueba).
 *  `silent: false` solicita explícitamente el sonido predeterminado del
 *  sistema — sin archivos de audio propios ni Audio() en paralelo (duplicaría
 *  el sonido o fallaría en segundo plano). La autoridad final es del sistema:
 *  si Safari, el modo de Concentración o los ajustes de la app silencian los
 *  avisos, esa decisión se respeta — silent:false solo pide, no evade. */
export function systemNotificationOptions(body: string, tag?: string): NotificationOptions {
  return {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    silent: false,
    ...(tag ? { tag } : {}),
  };
}

// ── Deduplicación tras recargas o montajes concurrentes ──────────────

/** Identifica de forma única «esta fase concreta de esta sesión concreta»:
 *  phaseStartedAt cambia en cada transición, así que la misma fase nunca
 *  produce dos claves distintas ni una fase distinta comparte clave. */
export function dedupKey(sessionId: string, kind: NotificationIntent["kind"], phaseStartedAt: string): string {
  return `${sessionId}:${kind}:${phaseStartedAt}`;
}

const MAX_DEDUP_KEYS = 20;

export function wasNotified(sentKeys: string[], key: string): boolean {
  return sentKeys.includes(key);
}

/** Añade la clave si falta, acotando la lista para que no crezca sin límite. */
export function markNotified(sentKeys: string[], key: string): string[] {
  if (sentKeys.includes(key)) return sentKeys;
  const next = [...sentKeys, key];
  return next.length > MAX_DEDUP_KEYS ? next.slice(next.length - MAX_DEDUP_KEYS) : next;
}

// ── Estado del permiso, para Ajustes ─────────────────────────────────

export type NotificationUiState = "no-compatible" | "no-configuradas" | "activadas" | "bloqueadas";

export const NOTIFICATION_UI_LABEL: Record<NotificationUiState, string> = {
  "no-compatible": "No compatibles con este dispositivo",
  "no-configuradas": "No configuradas",
  activadas: "Activadas",
  bloqueadas: "Bloqueadas por el sistema",
};

/** `permission` es el valor crudo de `Notification.permission` ("default" |
 *  "granted" | "denied") o null si la API ni siquiera existe. */
export function deriveNotificationUiState(
  supported: boolean,
  permission: NotificationPermission | null
): NotificationUiState {
  if (!supported) return "no-compatible";
  if (permission === "granted") return "activadas";
  if (permission === "denied") return "bloqueadas";
  return "no-configuradas";
}

// ── Ayuda para reactivar cuando el navegador bloqueó el permiso ──────

export type PlatformHint = "mac-safari" | "ios" | "otro";

export function detectPlatformHint(userAgent: string): PlatformHint {
  const ua = (userAgent || "").toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  const isSafari = /safari/.test(ua) && !/chrome|chromium|crios|fxios|edg/.test(ua);
  return isSafari ? "mac-safari" : "otro";
}

export const BLOCKED_HELP_TEXT: Record<PlatformHint, string> = {
  "mac-safari":
    "En Safari: menú Safari → Ajustes para este sitio web… → Notificaciones → Permitir (o Safari → Ajustes → Sitios web → Notificaciones).",
  ios: "En el iPhone: Ajustes → Mafer OS → Notificaciones → Activar. (Debes tener Mafer OS instalada en tu pantalla de inicio.)",
  otro: "Busca el ícono de candado o el menú de permisos junto a la barra de direcciones y activa las notificaciones para este sitio.",
};
