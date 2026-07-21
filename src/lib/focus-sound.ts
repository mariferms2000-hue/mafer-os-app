/* Aviso sonoro del Jardín de enfoque — chime sintetizado con Web Audio API,
   sin archivo de audio que mantener. Todas las funciones son no-ops
   seguros fuera del navegador (SSR) o si Web Audio no está disponible:
   el aviso simplemente no suena, nunca rompe el resto del overlay. */

const MUTE_STORAGE_KEY = "mafer-os:focus-sound-muted";

let sharedContext: AudioContext | null = null;

function getAudioContextClass(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  const w = window as typeof window & { webkitAudioContext?: typeof AudioContext };
  return window.AudioContext ?? w.webkitAudioContext ?? null;
}

/** Crea (una sola vez) y reanuda el AudioContext compartido. Llamar desde
 *  un gesto de usuario real (click) — las políticas de autoplay exigen eso
 *  para desbloquear audio; el chime en sí se dispara después, dentro de un
 *  setInterval, que no cuenta como gesto. */
export function primeFocusAudio(): void {
  const Ctor = getAudioContextClass();
  if (!Ctor) return;
  try {
    if (!sharedContext) sharedContext = new Ctor();
    if (sharedContext.state === "suspended") sharedContext.resume().catch(() => {});
  } catch {
    // Web Audio no disponible o bloqueada — el aviso no sonará esta vez.
  }
}

/** Campana descendente de tres notas (G5 → E5 → C4), tipo cuenco tibetano:
 *  ataque lento (nunca un golpe seco), cola larga que se desvanece sola y
 *  un leve armónico a la octava para dar calidez, no brillo. Pensada para
 *  "aterrizar" al terminar el enfoque sin sobresaltar. */
export function playFocusChime(): void {
  const Ctor = getAudioContextClass();
  if (!Ctor) return;
  try {
    if (!sharedContext) sharedContext = new Ctor();
    const ctx = sharedContext;
    const notes = [783.99, 659.25, 523.25];
    const noteSpacing = 0.42;
    const tailDuration = 1.6;
    const attack = 0.18;
    const peakGain = 0.1;
    const overtoneGain = 0.025;
    notes.forEach((freq, i) => {
      const start = ctx.currentTime + i * noteSpacing;
      [
        { freq, gain: peakGain },
        { freq: freq * 2, gain: overtoneGain },
      ].forEach(({ freq: f, gain: g }) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = f;
        gainNode.gain.setValueAtTime(0, start);
        gainNode.gain.linearRampToValueAtTime(g, start + attack);
        gainNode.gain.exponentialRampToValueAtTime(0.001, start + attack + tailDuration);
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + attack + tailDuration + 0.05);
      });
    });
  } catch {
    // Igual que arriba: fallo silencioso.
  }
}

export function isFocusSoundMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setFocusSoundMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (muted) window.localStorage.setItem(MUTE_STORAGE_KEY, "1");
    else window.localStorage.removeItem(MUTE_STORAGE_KEY);
  } catch {
    // localStorage puede fallar (modo privado, cuota) — la preferencia
    // simplemente no persiste esta vez.
  }
}
