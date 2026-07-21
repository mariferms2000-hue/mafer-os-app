import { describe, expect, it } from "vitest";
import { primeFocusAudio, playFocusChime, isFocusSoundMuted, setFocusSoundMuted } from "../src/lib/focus-sound";

/* Vitest corre en Node sin jsdom en este repo — estas pruebas cubren la
   rama SSR/sin-`window`: deben ser no-ops seguros, nunca lanzar. La
   reproducción real del tono no es probable en este harness (no hay
   jsdom) y se verifica a mano en el navegador. */
describe("focus-sound — sin entorno de navegador (SSR / Node)", () => {
  it("isFocusSoundMuted por defecto no está silenciado", () => {
    expect(isFocusSoundMuted()).toBe(false);
  });

  it("setFocusSoundMuted no truena sin `window`", () => {
    expect(() => setFocusSoundMuted(true)).not.toThrow();
  });

  it("primeFocusAudio no truena sin Web Audio disponible", () => {
    expect(() => primeFocusAudio()).not.toThrow();
  });

  it("playFocusChime no truena sin Web Audio disponible", () => {
    expect(() => playFocusChime()).not.toThrow();
  });
});
