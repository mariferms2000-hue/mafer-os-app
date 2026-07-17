# Pruebas y solución de problemas

## Correr las pruebas

```bash
npm run lint        # ESLint
npx tsc --noEmit    # tipos
npm run test:unit   # Vitest — exportadores (tests/)
npm run test:e2e    # Playwright — 20 flujos completos (e2e/)
```

- Las E2E levantan su propio servidor en el puerto 3900 con una base de datos limpia
  en `e2e/.test-db/` (se borra en cada corrida; jamás tocan tus datos reales).
- Proyecto `desktop` (Chrome) corre `flujo-principal.spec.ts`;
  proyecto `iphone` (viewport iPhone 14) corre `mobile.spec.ts`.
- Las capturas de QA se guardan en `../project-management/qa/`.

## Qué cubren las E2E

login primera vez y normal · rutas protegidas · captura → inbox → conversión a tarea ·
creación de proyecto con 7 listas · alta/edición/completado de tarjeta · drag & drop
con persistencia tras recarga · prioridades de Hoy · journal · learn fast · incubadora ·
prompts (crear + copiar al portapapeles) · recomendador de IA · calendario (evento →
agenda) · búsqueda global · export JSON · logout · móvil: navegación, captura, tablero,
calendario, sin scroll horizontal.

## Problemas comunes

| Síntoma | Causa probable | Solución |
|---|---|---|
| La app no abre (local, solo dev) | Node no instalado / dependencias | Instalar Node LTS; `npm install` en mafer-os-app |
| «Falta AUTH_SECRET» (local) | No existe .env.local | `npm run setup` |
| «Falta DATABASE_URL» | No existe .env.local o falta la variable | Agregar el connection string de Supabase a `.env.local` |
| iPhone no carga la app | Sin internet, o Vercel caído | Revisar conexión a internet; el hosting ya no depende de ninguna Mac ni red local |
| Google: «app sin verificar» | Normal en apps personales | Avanzado → Continuar (es tu propia app) |
| Google: redirect_uri_mismatch | URI distinta en Google Cloud | Debe coincidir con la URL de Vercel configurada en Google Cloud |
| Datos «desaparecieron» | — | La base vive en Supabase (Postgres), no en un archivo local; revisar el dashboard de Supabase / sus backups |
| Cambié el esquema y truena | Falta migración | `npx drizzle-kit generate` y redeploy |

## Limitaciones conocidas (honestas)

1. **En la nube**: la app vive en Vercel + Supabase (Postgres) — accesible desde cualquier
   red con internet, en el navegador o instalada como PWA. El modo local-en-la-Mac (SQLite)
   queda solo para desarrollo (`npm run dev`/`npm start` con SQLite ya no aplica: el driver
   actual requiere `DATABASE_URL` de Postgres incluso en local).
2. **Google Calendar probado con simulaciones**, no con OAuth vivo (requiere credenciales
   personales de Mafer). El código de la integración está completo y las rutas probadas.
3. **Offline**: la PWA muestra un aviso amable sin conexión, pero no edita datos offline.
4. **Sync Obsidian es unidireccional** (app → vault). Editar las carpetas auto-generadas
   del vault no actualiza la app (documentado en el propio vault).
5. **Un solo usuario**. La arquitectura permite multiusuario futuro (auth aislada en
   `src/lib/auth.ts`), pero V1 no lo implementa a propósito.
