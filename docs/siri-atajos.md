# Siri → Mafer OS (Atajos de iPhone)

Dos atajos para hablarle a Siri (iPhone y Siri en **inglés**):

- **«Hey Siri, Mafer Inbox»** → pregunta *What should I write down?* y lo guarda en **Inbox**.
- **«Hey Siri, Mafer Event»** → pregunta qué y cuándo, y lo guarda en el **Calendario** (y en Google Calendar si está conectado).

Siri contesta en inglés: *«Done, it's in your Mafer OS inbox.»*

> **Nombres:** no empieces el nombre del atajo con *note*, *add*, *remind*, *create* ni *send*: Siri los toma para sus propias apps («Note to Mafer OS» creaba una nota en Notas).
> **Idioma:** con Siri en inglés, lo que dictas se escribe en inglés.

## Cómo funciona

Cada atajo manda la información a `https://mafer-os-app.vercel.app/api/siri/…` junto con una **llave secreta** (`SIRI_TOKEN`). Sin ella, la app responde *Not authorized*. Estas rutas **solo pueden crear**: no leen, editan ni borran nada.

La llave vive en Vercel (variable `SIRI_TOKEN`), en `mafer-os-app/.env.local` y dentro de tus atajos. **No la compartas.** Si se filtra: genera otra, cámbiala en Vercel y en los atajos; la anterior deja de servir.

## Atajo 1: «Mafer Inbox»

App **Shortcuts** → **+** → renombrar a **Mafer Inbox**. Los bloques, **en este orden** (un bloque solo puede usar datos de bloques que estén *arriba*):

1. **Ask for Input** → *Ask for Text with* `What should I write down?`
2. **Get Contents of URL** → `https://mafer-os-app.vercel.app/api/siri/inbox`
   - Si aparece *Provided Input* en lugar de la URL, bórralo y escribe la URL.
   - Flechita ›: **Method** `POST`
   - **Headers** → Add new header: `Authorization` = `Bearer ` + la llave (con un espacio después de *Bearer*).
   - **Request Body** `JSON` → Add new field → Text: `texto` = **Provided Input** (con *Select Variable* → tocar el bloque *Ask for Text*). ⚠️ No *Shortcut Input*: se parece, pero no es lo que dictaste.
3. **Get Dictionary Value** → *Get Value for* `mensaje` *in Contents of URL*
4. **Show Result** → *Dictionary Value*

Prueba con ▶️ y luego con la voz: *«Hey Siri, Mafer Inbox»*.

## Atajo 2: «Mafer Event»

1. **Ask for Input** → *Text* → `What's the event?`
2. **Set Variable** → nombre `Titulo` → valor **Provided Input**
3. **Ask for Input** → tipo **Date and Time** → `When?` (se vale decir *tomorrow at 5 PM*, *Friday at 10*)
4. **Format Date** → *Provided Input* → formato **ISO 8601**, con hora
5. **Get Contents of URL** → `https://mafer-os-app.vercel.app/api/siri/evento`
   - **Method** `POST` · Header `Authorization` = `Bearer ` + llave
   - **Request Body** `JSON`:
     - `titulo` (Text) = variable **Titulo**
     - `fecha` (Text) = **Formatted Date**
     - *(opcional)* `duracion` (Number) = minutos; si no va, dura 60.
6. **Get Dictionary Value** → `mensaje` → **Show Result**

Siri contesta algo como: *«Done, I scheduled "Dentist" for Wednesday, October 7 at 5:30 PM and added it to Google Calendar.»*

> Evento de **todo el día**: en el paso 4 usa formato personalizado `yyyy-MM-dd` (sin hora).

## Formato que acepta la app (referencia técnica)

`POST /api/siri/inbox`

```json
{ "texto": "Llamar al dentista" }
```

`POST /api/siri/evento`

```json
{ "titulo": "Dentista", "fecha": "2026-10-07T17:30:00-06:00", "duracion": 60 }
```

- `fecha`: `AAAA-MM-DD` (todo el día) o ISO 8601 con hora. La hora se toma tal como la escribe el teléfono (tu hora local), sin pasarla a UTC.
- `hora` (opcional): `HH:MM`; si viene, gana a la hora del ISO.
- `duracion` (opcional): minutos, 60 por defecto. El evento no cruza la medianoche.

Respuestas (el `mensaje` va en inglés, Siri lo lee en voz alta): `200 { ok, mensaje }` · `400 { ok: false, mensaje }` (dato que no entendió) · `401` (llave incorrecta o `SIRI_TOKEN` sin configurar).

Código: `src/app/api/siri/*`, lógica y validación en `src/lib/siri-logic.ts`, pruebas en `tests/siri-logic.test.ts` y `e2e/siri.spec.ts`.
