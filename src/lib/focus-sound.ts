/* Aviso sonoro del Jardín de enfoque — reproduce uno de los ringtones de
   `public/sounds/focus/`, elegible por el usuario. Todas las funciones son
   no-ops seguros fuera del navegador (SSR) o si <audio> falla: el aviso
   simplemente no suena, nunca rompe el resto del overlay. */

export type FocusSoundOption = { id: string; label: string; src: string };

export const FOCUS_SOUND_OPTIONS: FocusSoundOption[] = [
  { id: "solo-os", label: "Solo OS", src: "/sounds/focus/solo-os.mp3" },
  { id: "sweet-ringtone", label: "Sweet Ringtone", src: "/sounds/focus/sweet-ringtone.mp3" },
  { id: "gta-san-andreas", label: "GTA San Andreas", src: "/sounds/focus/gta-san-andreas.mp3" },
  { id: "waaaooow", label: "Waaaooow", src: "/sounds/focus/waaaooow.mp3" },
];

const DEFAULT_SOUND_ID = FOCUS_SOUND_OPTIONS[0].id;

const MUTE_STORAGE_KEY = "mafer-os:focus-sound-muted";
const CHOICE_STORAGE_KEY = "mafer-os:focus-sound-choice";

// Algunos ringtones duran hasta 30s — para un aviso de pomodoro basta con
// reconocerlo, no con la canción completa: se corta con un fundido corto.
const MAX_PLAYBACK_MS = 6000;
const FADE_MS = 400;

let sharedAudio: HTMLAudioElement | null = null;
let sharedAudioSrc: string | null = null;
let fadeIntervalId: ReturnType<typeof setInterval> | null = null;
let stopTimeoutId: ReturnType<typeof setTimeout> | null = null;
let fadeTimeoutId: ReturnType<typeof setTimeout> | null = null;

function getSoundSrc(id: string): string {
  return FOCUS_SOUND_OPTIONS.find((o) => o.id === id)?.src ?? FOCUS_SOUND_OPTIONS[0].src;
}

/** Un solo <audio> reutilizado: en Safari el desbloqueo de autoplay es por
 *  instancia de elemento, no por `src` — crear uno nuevo en cada aviso
 *  perdería el desbloqueo logrado en `primeFocusAudio`. */
function getSharedAudio(src: string): HTMLAudioElement | null {
  if (typeof window === "undefined" || typeof Audio === "undefined") return null;
  if (!sharedAudio) sharedAudio = new Audio();
  if (sharedAudioSrc !== src) {
    sharedAudio.src = src;
    sharedAudioSrc = src;
  }
  return sharedAudio;
}

function clearPlaybackTimers(): void {
  if (fadeIntervalId !== null) clearInterval(fadeIntervalId);
  if (stopTimeoutId !== null) clearTimeout(stopTimeoutId);
  if (fadeTimeoutId !== null) clearTimeout(fadeTimeoutId);
  fadeIntervalId = null;
  stopTimeoutId = null;
  fadeTimeoutId = null;
}

function fadeOutAndStop(audio: HTMLAudioElement): void {
  const steps = 10;
  const startVolume = audio.volume;
  let step = 0;
  fadeIntervalId = setInterval(() => {
    step += 1;
    audio.volume = Math.max(0, startVolume * (1 - step / steps));
    if (step >= steps && fadeIntervalId !== null) {
      clearInterval(fadeIntervalId);
      fadeIntervalId = null;
      audio.pause();
      audio.currentTime = 0;
    }
  }, FADE_MS / steps);
}

/** Reproduce (y pausa de inmediato) el ringtone elegido en silencio, desde
 *  un gesto de usuario real (click) — las políticas de autoplay exigen eso
 *  para desbloquear el elemento; el aviso real se dispara después, dentro
 *  de un setInterval, que no cuenta como gesto. */
export function primeFocusAudio(): void {
  const audio = getSharedAudio(getSoundSrc(getFocusSoundChoice()));
  if (!audio) return;
  try {
    const prevMuted = audio.muted;
    audio.muted = true;
    const playPromise = audio.play();
    const reset = () => {
      audio.pause();
      audio.currentTime = 0;
      audio.muted = prevMuted;
    };
    if (playPromise && typeof playPromise.then === "function") {
      playPromise.then(reset).catch(() => {
        audio.muted = prevMuted;
      });
    } else {
      reset();
    }
  } catch {
    // Audio no disponible o bloqueado — el aviso no sonará esta vez.
  }
}

/** Suena el ringtone elegido por el usuario, cortado a los pocos segundos
 *  con un fundido corto si es más largo (p. ej. el de 30s). */
export function playFocusChime(): void {
  const audio = getSharedAudio(getSoundSrc(getFocusSoundChoice()));
  if (!audio) return;
  try {
    clearPlaybackTimers();
    audio.currentTime = 0;
    audio.volume = 1;
    audio.muted = false;
    void audio.play().catch(() => {});
    fadeTimeoutId = setTimeout(() => fadeOutAndStop(audio), Math.max(0, MAX_PLAYBACK_MS - FADE_MS));
    stopTimeoutId = setTimeout(() => {
      audio.pause();
      audio.currentTime = 0;
    }, MAX_PLAYBACK_MS);
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

export function getFocusSoundChoice(): string {
  if (typeof window === "undefined") return DEFAULT_SOUND_ID;
  try {
    const stored = window.localStorage.getItem(CHOICE_STORAGE_KEY);
    if (stored && FOCUS_SOUND_OPTIONS.some((o) => o.id === stored)) return stored;
    return DEFAULT_SOUND_ID;
  } catch {
    return DEFAULT_SOUND_ID;
  }
}

export function setFocusSoundChoice(id: string): void {
  if (typeof window === "undefined") return;
  if (!FOCUS_SOUND_OPTIONS.some((o) => o.id === id)) return;
  try {
    window.localStorage.setItem(CHOICE_STORAGE_KEY, id);
  } catch {
    // localStorage puede fallar (modo privado, cuota) — la preferencia
    // simplemente no persiste esta vez.
  }
}
