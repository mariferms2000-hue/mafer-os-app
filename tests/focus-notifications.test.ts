import { describe, expect, it } from "vitest";
import {
  focusEndCopy,
  breakStartCopy,
  breakEndCopy,
  intentForAutomaticAction,
  buildNotificationPayload,
  systemNotificationOptions,
  dedupKey,
  wasNotified,
  markNotified,
  deriveNotificationUiState,
  NOTIFICATION_UI_LABEL,
  detectPlatformHint,
  BLOCKED_HELP_TEXT,
  type NotificationIntent,
} from "../src/lib/focus-notifications";
import { initialState, transition, creditedMinutes, PRESETS } from "../src/lib/focus-logic";

/* Fase N1 — notificaciones locales del Pomodoro. Todo lo probado aquí es
   lógica pura (sin DOM): copy, decisión de qué avisar, dedupe y estado del
   permiso. El puente real hacia `Notification`/`localStorage`
   (notification-bridge.ts) es intencionalmente delgado y no se prueba aquí
   por no haber jsdom en el proyecto — se verificó manualmente en el
   navegador (ver informe de la Fase N1). */

describe("copy — tono sereno, sin culpa ni urgencia", () => {
  it("final de enfoque con tarea vinculada", () => {
    const { title, body } = focusEndCopy({ minutes: 25, taskTitle: "Escribir el informe" });
    expect(title).toBe("Tu bloque de enfoque terminó");
    expect(body).toBe("Terminaste 25 minutos en Escribir el informe. Tu planta sigue creciendo.");
  });

  it("final de enfoque en Enfoque libre (sin tarea)", () => {
    const { title, body } = focusEndCopy({ minutes: 15, taskTitle: null });
    expect(title).toBe("Tu bloque de enfoque terminó");
    expect(body).toBe("Terminaste 15 minutos de enfoque. Tu planta sigue creciendo.");
  });

  it("inicio de descanso (copy aprobado, aunque no se dispare automáticamente — ver más abajo)", () => {
    expect(breakStartCopy({ minutes: 5 })).toEqual({
      title: "Es momento de descansar",
      body: "Tienes 5 minutos para respirar antes del siguiente bloque.",
    });
  });

  it("final de descanso", () => {
    expect(breakEndCopy()).toEqual({
      title: "Tu descanso terminó",
      body: "Puedes comenzar otro bloque cuando estés lista.",
    });
  });

  it("ningún copy usa lenguaje de culpa, urgencia o racha", () => {
    const textos = [
      focusEndCopy({ minutes: 25, taskTitle: "X" }),
      focusEndCopy({ minutes: 25, taskTitle: null }),
      breakStartCopy({ minutes: 5 }),
      breakEndCopy(),
    ]
      .flatMap((c) => [c.title, c.body])
      .join(" ")
      .toLowerCase();
    for (const palabra of ["debiste", "fallaste", "racha", "urgente", "¡", "ahora mismo", "no dejes"]) {
      expect(textos).not.toContain(palabra);
    }
  });
});

describe("intentForAutomaticAction — qué avisar y cuándo NO avisar", () => {
  it("completar-enfoque produce focus-end con los minutos y la tarea", () => {
    const intent = intentForAutomaticAction("completar-enfoque", { minutes: 25, taskTitle: "Tarea X" });
    expect(intent).toEqual({ kind: "focus-end", minutes: 25, taskTitle: "Tarea X" });
  });

  it("terminar-descanso produce break-end sin datos extra", () => {
    const intent = intentForAutomaticAction("terminar-descanso", { minutes: 5, taskTitle: null });
    expect(intent).toEqual({ kind: "break-end" });
  });

  it("no existe ninguna forma de producir un intent de «inicio de descanso»: el tipo AutomaticFocusAction excluye «empezar-descanso» — esa transición SIEMPRE es un clic explícito de la usuaria (ver focus-logic.ts), así que un aviso de sistema sería un duplicado de algo que ella misma acaba de iniciar", () => {
    // Verificación en tiempo de ejecución de la garantía de tipos: las dos
    // únicas ramas de intentForAutomaticAction cubren focus-end y break-end.
    const kinds = new Set(
      (["completar-enfoque", "terminar-descanso"] as const).map(
        (a) => intentForAutomaticAction(a, { minutes: 1, taskTitle: null }).kind
      )
    );
    expect(kinds).toEqual(new Set(["focus-end", "break-end"]));
  });

  it("buildNotificationPayload compone el copy correcto por tipo", () => {
    const focusEnd: NotificationIntent = { kind: "focus-end", minutes: 25, taskTitle: null };
    const breakEnd: NotificationIntent = { kind: "break-end" };
    expect(buildNotificationPayload(focusEnd).title).toBe("Tu bloque de enfoque terminó");
    expect(buildNotificationPayload(breakEnd).title).toBe("Tu descanso terminó");
  });
});

describe("opciones del sistema — sonido predeterminado en TODA notificación", () => {
  it("las opciones comunes piden explícitamente el sonido del sistema (silent: false, jamás true ni undefined)", () => {
    const opts = systemNotificationOptions("cuerpo");
    expect(opts.silent).toBe(false);
  });

  it("final de enfoque: payload + opciones con silent: false y el tag de dedupe", () => {
    const { body } = buildNotificationPayload({ kind: "focus-end", minutes: 25, taskTitle: "Tarea X" });
    const opts = systemNotificationOptions(body, dedupKey("s1", "focus-end", "t0"));
    expect(opts.silent).toBe(false);
    expect(opts.body).toBe("Terminaste 25 minutos en Tarea X. Tu planta sigue creciendo.");
    expect(opts.tag).toBe("s1:focus-end:t0");
  });

  it("final de descanso: payload + opciones con silent: false", () => {
    const { body } = buildNotificationPayload({ kind: "break-end" });
    const opts = systemNotificationOptions(body, dedupKey("s1", "break-end", "t1"));
    expect(opts.silent).toBe(false);
    expect(opts.body).toBe("Puedes comenzar otro bloque cuando estés lista.");
  });

  it("la notificación de prueba (sin tag) también pide sonido y conserva iconos", () => {
    const opts = systemNotificationOptions("Así se verán tus avisos del Jardín de enfoque.");
    expect(opts.silent).toBe(false);
    expect(opts.tag).toBeUndefined();
    expect(opts.icon).toBe("/icons/icon-192.png");
    expect(opts.badge).toBe("/icons/icon-192.png");
  });

  it("con tag, iconos y cuerpo se conservan intactos (nada se pierde al pedir sonido)", () => {
    const opts = systemNotificationOptions("cuerpo", "una:clave");
    expect(opts).toEqual({
      body: "cuerpo",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      silent: false,
      tag: "una:clave",
    });
  });
});

describe("dedupe — como máximo un aviso por fase, incluso tras recargar", () => {
  it("una clave nueva no fue notificada", () => {
    expect(wasNotified([], "s1:focus-end:t0")).toBe(false);
  });

  it("markNotified agrega la clave y wasNotified la reconoce después", () => {
    const after = markNotified([], "s1:focus-end:t0");
    expect(after).toEqual(["s1:focus-end:t0"]);
    expect(wasNotified(after, "s1:focus-end:t0")).toBe(true);
  });

  it("markNotified es idempotente: repetir la misma clave no la duplica", () => {
    const once = markNotified([], "s1:focus-end:t0");
    const twice = markNotified(once, "s1:focus-end:t0");
    expect(twice).toEqual(["s1:focus-end:t0"]);
  });

  it("la lista de claves no crece sin límite", () => {
    let keys: string[] = [];
    for (let i = 0; i < 50; i++) keys = markNotified(keys, `s${i}:focus-end:t${i}`);
    expect(keys.length).toBeLessThanOrEqual(20);
    // conserva las más recientes
    expect(keys[keys.length - 1]).toBe("s49:focus-end:t49");
  });

  it("dedupKey distingue sesión, tipo y fase — la misma sesión con otra fase produce otra clave", () => {
    const k1 = dedupKey("s1", "focus-end", "2026-07-18T10:00:00.000Z");
    const k2 = dedupKey("s1", "break-end", "2026-07-18T10:00:00.000Z");
    const k3 = dedupKey("s1", "focus-end", "2026-07-18T10:25:00.000Z");
    expect(new Set([k1, k2, k3]).size).toBe(3);
  });

  it("misma sesión y misma fase (idéntico phaseStartedAt) producen la MISMA clave — el caso real de recarga", () => {
    const k1 = dedupKey("s1", "focus-end", "2026-07-18T10:00:00.000Z");
    const k2 = dedupKey("s1", "focus-end", "2026-07-18T10:00:00.000Z");
    expect(k1).toBe(k2);
  });
});

describe("estado del permiso para Ajustes", () => {
  it("navegador no compatible", () => {
    expect(deriveNotificationUiState(false, null)).toBe("no-compatible");
  });

  it("compatible pero sin decidir (default)", () => {
    expect(deriveNotificationUiState(true, "default")).toBe("no-configuradas");
    expect(deriveNotificationUiState(true, null)).toBe("no-configuradas");
  });

  it("permiso concedido", () => {
    expect(deriveNotificationUiState(true, "granted")).toBe("activadas");
  });

  it("permiso bloqueado por el sistema", () => {
    expect(deriveNotificationUiState(true, "denied")).toBe("bloqueadas");
  });

  it("las cuatro etiquetas visibles coinciden con las aprobadas", () => {
    expect(NOTIFICATION_UI_LABEL["no-compatible"]).toBe("No compatibles con este dispositivo");
    expect(NOTIFICATION_UI_LABEL["no-configuradas"]).toBe("No configuradas");
    expect(NOTIFICATION_UI_LABEL.activadas).toBe("Activadas");
    expect(NOTIFICATION_UI_LABEL.bloqueadas).toBe("Bloqueadas por el sistema");
  });
});

describe("ayuda para reactivar el permiso — instrucciones correctas por plataforma", () => {
  const UA_MAC_SAFARI =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
  const UA_IPHONE_SAFARI =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
  const UA_MAC_CHROME =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

  it("detecta Safari de Mac", () => {
    expect(detectPlatformHint(UA_MAC_SAFARI)).toBe("mac-safari");
  });

  it("detecta iPhone (Safari o PWA instalada)", () => {
    expect(detectPlatformHint(UA_IPHONE_SAFARI)).toBe("ios");
  });

  it("Chrome de Mac no se confunde con Safari (Chrome también incluye 'Safari' en su user agent)", () => {
    expect(detectPlatformHint(UA_MAC_CHROME)).toBe("otro");
  });

  it("user agent vacío o desconocido cae en 'otro' sin fallar", () => {
    expect(detectPlatformHint("")).toBe("otro");
  });

  it("cada plataforma tiene su propia instrucción, sin mezclarse", () => {
    expect(BLOCKED_HELP_TEXT["mac-safari"]).toMatch(/Safari/);
    expect(BLOCKED_HELP_TEXT.ios).toMatch(/iPhone/);
    expect(BLOCKED_HELP_TEXT.otro).not.toMatch(/Safari|iPhone/);
  });
});

describe("integración con el motor existente — la fuente de los minutos no cambia", () => {
  const T0 = "2026-07-18T10:00:00.000Z";
  const at = (min: number) => new Date(Date.parse(T0) + min * 60_000).toISOString();

  it("los minutos del aviso de final de enfoque son EXACTAMENTE los que el motor acredita (mismo creditedMinutes que usa focusTransitionAction)", () => {
    const s = initialState(PRESETS.pomodoro.focusMin, PRESETS.pomodoro.breakMin, T0);
    const nowIso = at(25); // el bloque completo de 25 min
    const minutos = creditedMinutes(s, nowIso);
    const intent = intentForAutomaticAction("completar-enfoque", { minutes: minutos, taskTitle: null });
    expect(intent).toEqual({ kind: "focus-end", minutes: 25, taskTitle: null });
  });

  it("pausar no es una transición automática: no existe forma de pasar 'pausar' a intentForAutomaticAction (error de tipos) y el motor no la marca como finished", () => {
    const s = initialState(25, 5, T0);
    const r = transition(s, "pausar", at(10));
    expect(r.finished).toBeUndefined();
  });

  it("terminar-antes finaliza la sesión pero NO es una acción automática — el motor la distingue de completar-enfoque", () => {
    const s = initialState(25, 5, T0);
    const r = transition(s, "terminar-antes", at(10));
    expect(r.finished?.outcome).toBe("terminada-antes");
    // La fase N1 solo notifica desde el intervalo de "due", que jamás llama
    // a "terminar-antes" (es exclusivo del botón manual) — por construcción,
    // esta transición nunca produce un NotificationIntent.
  });

  it("saltar-descanso finaliza la sesión pero es manual, nunca automática", () => {
    const s = { ...initialState(25, 5, T0), phase: "descanso" as const, phaseStartedAt: at(0) };
    const r = transition(s, "saltar-descanso", at(2));
    expect(r.finished?.outcome).toBe("completa");
  });
});
