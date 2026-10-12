# Previews de Vercel y bases de prueba

Cada rama que se sube a GitHub genera una **preview** en Vercel: una copia funcional
de la app con el código de esa rama. Las previews usan **datos ficticios** y nunca
tocan producción.

## Las tres bases (consolidación, oct 2026)

Todo Mafer OS vive en **un solo proyecto Supabase** (el de producción), en tres
bases separadas, cada una con su propio usuario de Postgres:

| Base | Usuario | La usa | Contenido |
|---|---|---|---|
| `postgres` | `postgres` (administrador) | `mafer-os-app.vercel.app` | Tus datos reales |
| `mafer_preview` | `mafer_preview_app` | Vercel Preview | Datos ficticios que se conservan |
| `mafer_e2e` | `mafer_e2e_app` | Pruebas E2E (Playwright) | Se **vacía entera** antes de cada corrida |

- `mafer_preview_app` y `mafer_e2e_app` no son administradores, no heredan
  permisos de nadie y **no tienen ningún permiso sobre las tablas reales**
  (verificado: cualquier lectura de la base `postgres` responde «permiso denegado»).
- Cada base nueva está cerrada a los demás usuarios (`REVOKE CONNECT … FROM PUBLIC`):
  el usuario de E2E no puede entrar a la de previews, ni al revés.
- El proyecto `mafer-os-testing` quedó **pausado** como reversión (ver abajo); el
  segundo cupo gratuito de Supabase queda para Finanzas.

## Protecciones

1. **Vercel Authentication** (Deployment Protection, modo *Standard*): toda URL de
   despliegue —previews y despliegues antiguos de producción— pide iniciar sesión
   en Vercel. Solo los dominios de producción (`mafer-os-app.vercel.app`) son
   públicos, porque los usan Siri y Google.
2. **Variables separadas por entorno** en Vercel:
   - `AUTH_SECRET` distinta en Production, Preview y Development: una sesión de
     una preview no sirve en producción.
   - `DATABASE_URL` de Preview → `mafer_preview` con el usuario `mafer_preview_app`.
   - Preview **no** tiene `GOOGLE_*`, `SIRI_TOKEN` ni `SUPABASE_SECRET_KEY`.
3. **Candado en el código** (`src/lib/data-environment.ts`): con `VERCEL_ENV=preview`,
   la app solo funciona si la base tiene `settings.data_environment = preview`.
   Si una preview apuntara a otra base (producción incluida), muestra «Preview
   bloqueada» y no deja iniciar sesión ni crear contraseña. En producción y en
   local el candado no consulta nada.
4. **Google y Siri apagados en Preview aunque alguien añada sus variables**:
   `isGoogleConfigured()` devuelve `false` y `/api/siri/*` responde 404.
5. **Guardias de scripts** (`scripts/lib/require-test-db.mjs`): las E2E se niegan a
   correr contra `mafer_preview`; los scripts de preview se niegan a usar la URL
   de producción o la de E2E. Dentro del proyecto de producción, las E2E solo
   pueden usar `mafer_e2e` y las previews solo `mafer_preview`, y **nunca** con el
   usuario administrador `postgres`.
6. **Etiqueta «PREVIEW»** fija arriba al centro en todas las pantallas.

## Entrar a una preview

1. Inicia sesión en Vercel (vercel.com) en el navegador: una vez en la Mac y una
   vez en Safari del iPhone.
2. Abre la URL de la rama: `https://mafer-os-app-git-<rama>-mafer-os.vercel.app`
   (las `/` del nombre de la rama se vuelven `-`).
3. Contraseña de la app: la de `PREVIEW_LOGIN_PASSWORD` en `.env.local` (NO es la
   de producción). Lo cómodo es entrar primero en Safari de la Mac y dejar que la
   guarde en Contraseñas de iCloud: así aparece sola en el iPhone.

## Comandos (desde la Mac, con `.env.local`)

| Comando | Qué hace |
|---|---|
| `npm run db:migrate:preview` | Crea `mafer_preview` si falta, la cierra a otros usuarios y aplica las migraciones |
| `npm run db:migrate:test` | Lo mismo para `mafer_e2e` |
| `npm run seed:preview` | Siembra si está vacía; si ya está sembrada, solo actualiza la contraseña |
| `npm run seed:preview -- --reset` | Vacía y vuelve a sembrar (solo si lleva la marca de preview) |

Variables locales necesarias (en `.env.local`, nunca en Git):
`PREVIEW_DATABASE_URL` (pooler, puerto 6543, base `mafer_preview`),
`PREVIEW_MIGRATE_DATABASE_URL` (sesión, puerto 5432) y `PREVIEW_LOGIN_PASSWORD`.

Para **cambiar la contraseña de preview**: edita `PREVIEW_LOGIN_PASSWORD` en
`.env.local` y corre `npm run seed:preview`.

## Credenciales de las E2E

No están en el repositorio. `playwright.config.ts` genera al azar, en cada corrida,
la contraseña, el `AUTH_SECRET` y la llave de Siri del servidor de pruebas
(`E2E_PASSWORD`, `E2E_AUTH_SECRET`, `E2E_SIRI_TOKEN`); las pruebas las leen de
`e2e/lib/credentials.ts`. La contraseña `prueba-mafer-123` que aparece en el
historial de Git está retirada: ya no abre nada.

## Si una preview no abre

- **«Preview bloqueada»**: la `DATABASE_URL` de Preview no apunta a `mafer_preview`.
- **Error de conexión o «Algo salió mal»** (también en producción): Supabase pausa
  los proyectos gratuitos tras ~7 días sin uso. Si los registros dicen
  `tenant/user … not found`, el proyecto está pausado: supabase.com → proyecto →
  *Resume project*. No es un error del código.

## Reversión de la consolidación

Si algo fallara con las bases nuevas: reanudar `mafer-os-testing` en Supabase y
volver a poner las URLs anteriores, que quedaron comentadas como `OLD_…` en
`.env.local` (locales) y la `DATABASE_URL` de Preview en Vercel. Producción
nunca cambió de conexión.
- **Pide iniciar sesión en Vercel**: es lo esperado (Vercel Authentication).
- Una variable nueva en Vercel solo la toman los despliegues **nuevos**: vuelve a
  subir la rama o usa *Redeploy*.
