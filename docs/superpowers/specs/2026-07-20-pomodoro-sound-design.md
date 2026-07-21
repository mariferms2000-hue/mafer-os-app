# Aviso sonoro al terminar el pomodoro — diseño

## Problema

Cuando un bloque de enfoque o de descanso del Jardín de enfoque llega a cero,
la única señal es visual (el contador y el cambio de vista). Si Mafer no está
mirando la pantalla, no se entera. Se pide un aviso sonoro característico y
no estresante.

## Alcance

- Suena en las dos transiciones **en vivo** que hoy detecta el `setInterval`
  de `focus-overlay.tsx`: fin del bloque de enfoque (`completar-enfoque`) y
  fin del descanso (`terminar-descanso`).
- **No** suena en la recuperación al reabrir (`recover()` en
  `focus-logic.ts`), cuando la sesión ya terminó mientras la app estaba
  cerrada — sonar ahí sería una alerta fuera de contexto, sin relación con lo
  que Mafer está haciendo en ese momento.
- Silenciable con un toggle persistente (localStorage), visible en el header
  del overlay.

## Sonido

Tono sintetizado con Web Audio API — sin archivo de audio que conseguir ni
mantener. Dos notas ascendentes tipo campanita suave (p. ej. D5 → G5), cada
una con envolvente de ataque rápido y decay suave (evita clicks), duración
total ~1 s, ganancia baja (~0.15) para que no compita ni sobresalte.

Nuevo módulo `src/lib/focus-sound.ts` (client-only):

- `primeFocusAudio()` — crea/reanuda el `AudioContext` compartido. Se llama
  desde gestos de usuario reales (click en Empezar, Pausar, Reanudar, etc.)
  porque las políticas de autoplay de los navegadores exigen un gesto para
  desbloquear audio, y el disparo real ocurre después, dentro de un
  `setInterval` — que no cuenta como gesto.
- `playFocusChime()` — reproduce el tono si el contexto está disponible.
  Falla en silencio (try/catch) si Web Audio no está disponible.
- `isFocusSoundMuted()` / `setFocusSoundMuted(muted)` — preferencia en
  `localStorage` bajo la clave `mafer-os:focus-sound-muted`, default `false`.

## Cambios en `focus-overlay.tsx`

- Estado `soundMuted`, sincronizado con `isFocusSoundMuted()` en un
  `useEffect` (evita mismatch de hidratación: arranca en `false`, se corrige
  al montar en cliente).
- Un `ref` (`soundMutedRef`) espeja `soundMuted` para que el closure del
  `setInterval` existente (dependencias `[session?.id, session?.phase,
  session?.phaseStartedAt]`, no incluye `soundMuted`) siempre lea el valor
  vigente sin tener que reiniciar el intervalo.
- En el bloque `if (due && !completingRef.current)` existente: si
  `!soundMutedRef.current`, llamar `playFocusChime()` antes de disparar la
  transición.
- `primeFocusAudio()` se llama al inicio de `act()` y de `begin()`
  (fire-and-forget) para desbloquear el audio en el primer gesto real de la
  sesión.
- Botón nuevo en el header, junto al de cerrar: iconos `Volume2`/`VolumeX`
  de `lucide-react`, mismo estilo `btn btn-ghost` que el resto de botones
  del header, `aria-pressed`, `data-testid="focus-sound-toggle"`.

## Testing

`vitest.config.ts` no configura `environment: "jsdom"` (corre en Node
puro) — por eso `focus-sound.ts` solo lleva test unitario para su rama
SSR/sin-`window` (que sí corre en Node sin jsdom); no hay forma de probar
la reproducción real de Web Audio en este harness sin añadir jsdom, y eso
está fuera de alcance de esta feature. No se tocan los specs e2e existentes
de Jardín de enfoque — usan `data-testid`, no cuentan botones del header.

## Fuera de alcance

- Elegir entre varios sonidos o personalizar el timbre.
- Vibración / notificaciones del sistema operativo.
- Sonido distinto para "fin de enfoque" vs "fin de descanso" (se pidió el
  mismo aviso, sin distinguir).
