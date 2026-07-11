# Arquitectura técnica de Mafer OS

## Stack

- **Next.js 16** (App Router, React 19, Server Components + Server Actions)
- **TypeScript** estricto
- **Tailwind CSS 4** con tokens propios (`src/app/globals.css`, bloque `@theme`)
- **SQLite** vía better-sqlite3 + **Drizzle ORM** (`src/lib/db/`)
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
        src/lib/db  ── better-sqlite3 ──▶  data/mafer-os.db (WAL)
                                                │
                     scripts/ (backup, sync:obsidian) leen la misma base
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
- `src/proxy.ts` (convención Next 16, antes middleware) redirige a /login sin sesión
  válida; `requireAuth()` re-verifica en cada acción.
- Cambio de contraseña en Ajustes verifica la actual primero.
- Recuperación: borrar `password_hash` de `settings` (ver manual «Recuperación») —
  los datos nunca se pierden por olvidar la contraseña.

## Migraciones

- Esquema fuente: `src/lib/db/schema.ts`.
- `npx drizzle-kit generate` produce SQL en `drizzle/`; `migrate()` lo aplica
  automáticamente al abrir la conexión (`src/lib/db/index.ts`), por lo que una base
  nueva se crea sola al iniciar la app.
- Para cambiar el esquema: editar schema.ts → `npx drizzle-kit generate` → reiniciar.

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

## Exportación y respaldo

- Servidor: `src/lib/export/exporters.ts` + rutas `/api/export/{json,markdown}`.
- Local (sin servidor): `scripts/lib-export.mjs` compartido por `backup.mjs` y
  `sync-obsidian.mjs`. La duplicación app/scripts es deliberada (los scripts funcionan
  con la app apagada) y está cubierta por tests unitarios.
- El respaldo del binario usa `db.backup()` (consistente con WAL), no copia de archivo.

## Estructura de carpetas

Ver `mafer-os-vault/10 - Manuales/Modificar con Claude Code.md` para el mapa orientado
a cambios. Decisiones de arquitectura: `../project-management/adr/`.
