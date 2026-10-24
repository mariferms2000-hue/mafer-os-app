# Arquitectura técnica de Mafer OS

## Stack

- **Next.js 16** (App Router, React 19, Server Components + Server Actions)
- **TypeScript** estricto
- **Tailwind CSS 4** con tokens propios (`src/app/globals.css`, bloque `@theme`)
- **Supabase (Postgres)** vía postgres-js + **Drizzle ORM** (`src/lib/db/`) — antes SQLite local (`better-sqlite3`); los scripts locales (`seed.mjs`, `backup.mjs`, `sync-obsidian.mjs`, `inventory-agents.mjs`) siguen usando SQLite y quedan desactualizados frente a la fuente de verdad
- **dnd-kit** para drag & drop (mouse, trackpad y touch)
- **jose** (JWT firmado) + **bcryptjs** para autenticación local de usuario único
- **googleapis** para Google Calendar (OAuth 2, scope `calendar.app.created`)
- **Vitest** (unitarias) + **Playwright** (E2E, proyectos desktop e iPhone)

## Flujo de datos

```
Navegador ──(HTTP + cookie mafer_session)──▶ Next.js (proxy.ts verifica JWT)
   │                                            │
   │  Server Components (lecturas)              │  Server Actions (escrituras)
   ▼                                            ▼
        src/lib/db  ── postgres-js ──▶  Supabase (Postgres, hosteado)

  scripts/ (backup, sync:obsidian, seed, inventory) siguen leyendo un SQLite
  local aparte — desincronizados de la fuente de verdad, ver sección de stack
```

- Todas las páginas de la app son dinámicas (`force-dynamic`) y leen la base en el servidor.
- Las escrituras pasan por Server Actions en `src/lib/actions/*` — cada una llama
  `requireAuth()` antes de tocar datos.
- `revalidatePath` refresca las vistas afectadas tras cada mutación.
- El tablero usa estado optimista en el cliente (`board.tsx`) y persiste orden/columna
  con `moveCardAction`.

## Autenticación

- Usuario único. Primera visita → crear contraseña (bcrypt, factor 12) guardada en la
  tabla `settings`.
- Sesión: JWT HS256 firmado con `AUTH_SECRET` (.env.local), cookie httpOnly de 90 días.
  En Vercel cada entorno (Production, Preview, Development) tiene su propia
  `AUTH_SECRET`: una sesión de una preview nunca vale en producción. Previews,
  bases de prueba y sus protecciones: ver `docs/previews.md`.
- `src/proxy.ts` (convención Next 16, antes middleware) redirige a /login sin sesión
  válida; `requireAuth()` re-verifica en cada acción.
- Cambio de contraseña en Ajustes verifica la actual primero.
- Recuperación: borrar `password_hash` de `settings` (ver manual «Recuperación») —
  los datos nunca se pierden por olvidar la contraseña.

## Migraciones

- Esquema fuente: `src/lib/db/schema.ts` (dialecto `postgresql`).
- `npx drizzle-kit generate` produce SQL en `drizzle/`; `migrate()` lo aplica
  automáticamente al abrir la conexión (`src/lib/db/index.ts`), por lo que una base
  nueva se crea sola al iniciar la app. Correr en cada cold start es idempotente
  (tabla de tracking de Drizzle) — aceptable para una app de un solo usuario.
- Para cambiar el esquema: editar schema.ts → `npx drizzle-kit generate` → reiniciar.
- `drizzle-sqlite-archive/` conserva el historial de migraciones de la era SQLite
  (referencia, no se aplica más).

## Google Calendar

`src/lib/google/calendar.ts`:
- Sin `GOOGLE_CLIENT_ID/SECRET` en el entorno, todo es no-op (la app no depende de Google).
- OAuth: `/api/google/connect` → consentimiento → `/api/google/callback` → tokens en
  `settings` (solo servidor; jamás llegan al cliente).
- Calendario dedicado «Mafer OS» creado con scope mínimo `calendar.app.created`
  (la app solo puede tocar calendarios que ella creó).
- Cada evento lleva `extendedProperties.private.maferOsRef = "event:<id>" | "card:<id>"`
  para trazabilidad y prevención de duplicados; el id de Google se guarda en la fila local.
- Sincronización: eventos al crearse/editarse/borrarse; tarjetas cuando su campo
  `reminder` es `gcal-timed`/`gcal-allday` (al guardar el detalle).
- Errores de sync no rompen la operación local (catch + registro).

### Avisos de tareas (Bloque 3, oct 2026)

`src/lib/avisos/` (reglas puras en `logic.ts`, Google/simulador en `gcal.ts`,
sincronización en `sync.ts`; acciones en `src/lib/actions/avisos.ts`):
- «🔔 Avisarme» es opcional por tarea: una fila en `card_reminders` (migración aditiva
  0002) con la anticipación (a la hora, 10, 30, 60 min o 1 día). Poner fecha u hora
  nunca lo enciende. Sin hora, el formulario propone 9:00.
- Cada aviso es un evento de 15 min en el calendario aparte «Mafer OS · Avisos», con
  `reminders.overrides` explícito (no las alertas predeterminadas) y las marcas
  `maferOsRef = card:<id>` + `maferOsAviso = 1`. Antes de insertar se busca por marca:
  no hay duplicados.
- Crear, editar, completar/deshacer, archivar/restaurar, eliminar, reprogramar y mover
  a Terminado actualizan Google. Un fallo NO se calla: queda en `last_error`, se
  muestra en la tarea, en Hoy y en Ajustes, y se arregla con «Reparar avisos».
- Interruptor general `settings.avisos_activos`: apagado, la app se comporta como
  antes (selector «Recordatorio» y calendario «Mafer OS»). Se enciende en Ajustes →
  Avisos tras un aviso de prueba y la confirmación del iPhone. Que Alexa lea los avisos
  es una preferencia (se ajusta en la app de Alexa), no una condición.
- Los recordatorios anteriores (`cards.reminder = gcal-*`) y los eventos fantasma solo
  se tocan desde la revisión de Ajustes → Avisos: muestra los eventos concretos y
  aplica únicamente lo que Mafer marca y confirma, recomprobando cada uno.
- Previews y E2E usan SIEMPRE el simulador (`VERCEL_ENV=preview` o
  `GOOGLE_SIMULATED=1`): los «eventos» viven en `settings` (`sim_gcal_ev:*`).
- Prueba local con la cuenta real: `GOOGLE_CALENDAR_SUFFIX=" (PRUEBA)"` marca los
  calendarios que la app crea, para reconocerlos y borrarlos al terminar.

## Exportación y respaldo

- Servidor: `src/lib/export/exporters.ts` + rutas `/api/export/{json,markdown}`.
- Local (sin servidor): `scripts/lib-export.mjs` compartido por `backup.mjs` y
  `sync-obsidian.mjs`. La duplicación app/scripts es deliberada (los scripts funcionan
  con la app apagada) y está cubierta por tests unitarios.
- El botón «Respaldo» de Ajustes escribe el JSON + Markdown (vía Drizzle, ya no depende
  de SQLite); el respaldo binario/point-in-time de la base real lo cubre Supabase
  (dashboard del proyecto), no un botón de la app.

## Estructura de carpetas

Ver `mafer-os-vault/10 - Manuales/Modificar con Claude Code.md` para el mapa orientado
a cambios. Decisiones de arquitectura: `../project-management/adr/`.
