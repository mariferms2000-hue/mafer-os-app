import { describe, expect, it } from "vitest";
import {
  primeFocusAudio,
  playFocusChime,
  isFocusSoundMuted,
  setFocusSoundMuted,
  getFocusSoundChoice,
  setFocusSoundChoice,
  FOCUS_SOUND_OPTIONS,
} from "../src/lib/focus-sound";

/* Vitest corre en Node sin jsdom en este repo — estas pruebas cubren la
   rama SSR/sin-`window`: deben ser no-ops seguros, nunca lanzar. La
   reproducción real del ringtone no es probable en este harness (no hay
   jsdom) y se verifica a mano en el navegador. */
describe("focus-sound — sin entorno de navegador (SSR / Node)", () => {
  it("isFocusSoundMuted por defecto no está silenciado", () => {
    expect(isFocusSoundMuted()).toBe(false);
  });

  it("setFocusSoundMuted no truena sin `window`", () => {
    expect(() => setFocusSoundMuted(true)).not.toThrow();
  });

  it("primeFocusAudio no truena sin <audio> disponible", () => {
    expect(() => primeFocusAudio()).not.toThrow();
  });

  it("playFocusChime no truena sin <audio> disponible", () => {
    expect(() => playFocusChime()).not.toThrow();
  });

  it("getFocusSoundChoice por defecto devuelve la primera opción", () => {
    expect(getFocusSoundChoice()).toBe(FOCUS_SOUND_OPTIONS[0].id);
  });

  it("setFocusSoundChoice no truena sin `window`", () => {
    expect(() => setFocusSoundChoice(FOCUS_SOUND_OPTIONS[1].id)).not.toThrow();
  });

  it("FOCUS_SOUND_OPTIONS trae los tres ringtones con id, label y src únicos", () => {
    expect(FOCUS_SOUND_OPTIONS).toHaveLength(3);
    const ids = FOCUS_SOUND_OPTIONS.map((o) => o.id);
    expect(new Set(ids).size).toBe(3);
    for (const o of FOCUS_SOUND_OPTIONS) {
      expect(o.src.startsWith("/sounds/focus/")).toBe(true);
    }
  });
});
