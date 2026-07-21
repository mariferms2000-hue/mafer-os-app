# Aviso sonoro al terminar el pomodoro — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reproducir un chime suave y no estresante cuando un bloque de enfoque o de descanso del Jardín de enfoque llega a cero en vivo, silenciable por Mafer.

**Architecture:** Un módulo nuevo `src/lib/focus-sound.ts` sintetiza el tono con Web Audio API (sin archivo de audio) y expone `primeFocusAudio`/`playFocusChime`/`isFocusSoundMuted`/`setFocusSoundMuted`. `focus-overlay.tsx` lo consume: prepara el audio en cada gesto de usuario real (botones), dispara el chime en el `setInterval` existente cuando detecta que un contador llegó a cero, y expone un toggle de silencio en el header del overlay.

**Tech Stack:** TypeScript, React 19 (Next.js 16, cliente), Web Audio API, `localStorage`, Vitest.

## Global Constraints

- El sonido solo dispara en transiciones **en vivo** (dentro del `setInterval` de `focus-overlay.tsx`), nunca en la recuperación al reabrir (`recover()` de `focus-logic.ts`).
- Sin archivo de audio nuevo: el tono se sintetiza en código.
- Cualquier fallo de Web Audio o `localStorage` (SSR, navegador sin soporte, contexto bloqueado, modo privado) debe fallar en silencio — nunca lanzar ni romper el resto del overlay.
- `vitest.config.ts` no configura entorno jsdom (corre en Node puro): `focus-sound.ts` solo lleva test unitario para su rama SSR/sin-`window` (que sí corre en Node sin jsdom); la reproducción real de Web Audio no es probable en este harness y se verifica a mano en el navegador.
- Iconos `Volume2`/`VolumeX` de `lucide-react`, mismo estilo `btn btn-ghost` que el resto de botones del header.

---

### Task 1: Módulo `focus-sound.ts`

**Files:**
- Create: `src/lib/focus-sound.ts`
- Test: `tests/focus-sound.test.ts`

**Interfaces:**
- Produces: `primeFocusAudio(): void`, `playFocusChime(): void`, `isFocusSoundMuted(): boolean`, `setFocusSoundMuted(muted: boolean): void` — todas exportadas desde `src/lib/focus-sound.ts`, todas seguras de llamar sin `window` (SSR) y sin lanzar.

- [ ] **Step 1: Write the failing test**

Crea `tests/focus-sound.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/focus-sound.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/focus-sound'` (el archivo no existe todavía).

- [ ] **Step 3: Write minimal implementation**

Crea `src/lib/focus-sound.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/focus-sound.test.ts`
Expected: PASS — 4 tests verdes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/focus-sound.ts tests/focus-sound.test.ts
git commit -m "feat(focus): chime sintetizado con Web Audio para el fin del pomodoro"
```

---

### Task 2: Conectar el chime y el toggle de silencio en `focus-overlay.tsx`

**Files:**
- Modify: `src/components/focus/focus-overlay.tsx:1-5` (imports), `:115-136` (estado del componente), `:176-194` (intervalo que detecta `due`), `:267-283` (`act`/`begin`), `:328-341` (header del overlay)

**Interfaces:**
- Consumes: `primeFocusAudio`, `playFocusChime`, `isFocusSoundMuted`, `setFocusSoundMuted` de `src/lib/focus-sound.ts` (Task 1).

- [ ] **Step 1: Añadir imports**

En `src/components/focus/focus-overlay.tsx:5`, cambia:

```ts
import { X, Play, Pause, CheckCircle2, SkipForward, Leaf, Sprout, ChevronDown } from "lucide-react";
```

por:

```ts
import { X, Play, Pause, CheckCircle2, SkipForward, Leaf, Sprout, ChevronDown, Volume2, VolumeX } from "lucide-react";
```

Justo debajo del bloque de imports de `@/lib/focus-logic` (línea 34), añade:

```ts
import { primeFocusAudio, playFocusChime, isFocusSoundMuted, setFocusSoundMuted } from "@/lib/focus-sound";
```

- [ ] **Step 2: Estado y ref del silencio**

En `src/components/focus/focus-overlay.tsx`, dentro de `export function FocusOverlay(...)`, junto a los demás `useState` (cerca de la línea 124, después de `const [announcement, setAnnouncement] = useState("");`), añade:

```ts
const [soundMuted, setSoundMuted] = useState(false);
const soundMutedRef = useRef(false);
```

Después del bloque de `useState`/`useRef` existentes (después de `const completingRef = useRef(false);`, línea 128), añade dos efectos nuevos:

```ts
// Sincroniza la preferencia de silencio guardada — arranca en false para
// no desajustar la hidratación, se corrige al montar en cliente.
useEffect(() => {
  setSoundMuted(isFocusSoundMuted());
}, []);

// El intervalo de abajo captura closures viejos (sus dependencias no
// incluyen soundMuted); el ref le da el valor vigente sin reiniciarlo.
useEffect(() => {
  soundMutedRef.current = soundMuted;
}, [soundMuted]);
```

- [ ] **Step 3: Disparar el chime en la transición en vivo**

En el `useEffect` del intervalo (línea 176-194 actual), dentro del bloque:

```ts
if (due && !completingRef.current) {
  completingRef.current = true;
  const action: FocusAction = session.phase === "enfoque" ? "completar-enfoque" : "terminar-descanso";
  void applyAction(action).finally(() => {
    completingRef.current = false;
  });
}
```

cambia a:

```ts
if (due && !completingRef.current) {
  completingRef.current = true;
  if (!soundMutedRef.current) playFocusChime();
  const action: FocusAction = session.phase === "enfoque" ? "completar-enfoque" : "terminar-descanso";
  void applyAction(action).finally(() => {
    completingRef.current = false;
  });
}
```

- [ ] **Step 4: Preparar el audio en gestos de usuario reales**

En `act` y `begin` (línea 267-283 actual):

```ts
function act(action: FocusAction) {
  start(() => applyAction(action));
}

function begin() {
  start(async () => {
    await startFocusAction({
```

cambia a:

```ts
function act(action: FocusAction) {
  primeFocusAudio();
  start(() => applyAction(action));
}

function begin() {
  primeFocusAudio();
  start(async () => {
    await startFocusAction({
```

(el resto del cuerpo de `begin` queda igual).

- [ ] **Step 5: Toggle de silencio en el header**

En `src/components/focus/focus-overlay.tsx:328-341` actual:

```tsx
<div className="relative flex items-center justify-center mb-2">
  <h2 className="section-eyebrow !text-sage-deep flex items-center gap-1.5">
    <Sprout size={13} aria-hidden /> Jardín de enfoque
  </h2>
  <button
    type="button"
    onClick={onClose}
    aria-label={session && !closed ? "Cerrar — la sesión sigue corriendo" : "Cerrar"}
    className="btn btn-ghost !p-1.5 absolute right-0 top-1/2 -translate-y-1/2"
    data-testid="focus-close"
  >
    <X size={17} aria-hidden />
  </button>
</div>
```

cambia a:

```tsx
<div className="relative flex items-center justify-center mb-2">
  <h2 className="section-eyebrow !text-sage-deep flex items-center gap-1.5">
    <Sprout size={13} aria-hidden /> Jardín de enfoque
  </h2>
  <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1">
    <button
      type="button"
      onClick={() => {
        const next = !soundMuted;
        setSoundMuted(next);
        setFocusSoundMuted(next);
      }}
      aria-label={soundMuted ? "Activar aviso sonoro del pomodoro" : "Silenciar aviso sonoro del pomodoro"}
      aria-pressed={!soundMuted}
      className="btn btn-ghost !p-1.5"
      data-testid="focus-sound-toggle"
    >
      {soundMuted ? <VolumeX size={16} aria-hidden /> : <Volume2 size={16} aria-hidden />}
    </button>
    <button
      type="button"
      onClick={onClose}
      aria-label={session && !closed ? "Cerrar — la sesión sigue corriendo" : "Cerrar"}
      className="btn btn-ghost !p-1.5"
      data-testid="focus-close"
    >
      <X size={17} aria-hidden />
    </button>
  </div>
</div>
```

- [ ] **Step 6: Verificar tipos, lint y suite completa**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos relacionados a `focus-overlay.tsx` ni `focus-sound.ts`.

Run: `npm run lint`
Expected: sin errores nuevos.

Run: `npx vitest run`
Expected: todos los tests pasan (incluye los 4 de `tests/focus-sound.test.ts` de Task 1 y los existentes de `tests/focus-logic.test.ts`).

- [ ] **Step 7: Verificación manual en navegador**

Run: `npm run dev`

En el navegador:
1. Abre el Jardín de enfoque, elige el preset **Arranque** (5 min — o usa el personalizado con el mínimo permitido) y pulsa **Empezar**.
2. Espera a que el contador llegue a cero sin cerrar el overlay: debe sonar el chime justo cuando pasa a «Bloque completo».
3. Pulsa el botón de silencio en el header (`data-testid="focus-sound-toggle"`), inicia otra sesión corta y deja que termine: no debe sonar nada.
4. Recarga la página con una sesión activa cuyo tiempo ya se agotó (o espera a que expire con la pestaña oculta) y vuelve a abrir el overlay: la recuperación debe mostrar el resultado sin sonido retroactivo.
5. Confirma que el toggle de silencio persiste al cerrar y reabrir el overlay (usa `localStorage`).

Expected: los 5 puntos se comportan como se describe, sin errores en la consola del navegador.

- [ ] **Step 8: Commit**

```bash
git add src/components/focus/focus-overlay.tsx
git commit -m "feat(focus): chime y toggle de silencio al terminar enfoque/descanso"
```
