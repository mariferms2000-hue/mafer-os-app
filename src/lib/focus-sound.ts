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
    if (sharedContext.state === "suspended") void sharedContext.resume();
  } catch {
    // Web Audio no disponible o bloqueada — el aviso no sonará esta vez.
  }
}

/** Chime de dos notas ascendentes (D5 → G5), suave y corto (~1s),
 *  ganancia baja para no competir ni sobresaltar. */
export function playFocusChime(): void {
  const Ctor = getAudioContextClass();
  if (!Ctor) return;
  try {
    if (!sharedContext) sharedContext = new Ctor();
    const ctx = sharedContext;
    const notes = [587.33, 783.99];
    const noteDuration = 0.5;
    const peakGain = 0.15;
    notes.forEach((freq, i) => {
      const start = ctx.currentTime + i * noteDuration * 0.85;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(peakGain, start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, start + noteDuration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + noteDuration + 0.05);
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
