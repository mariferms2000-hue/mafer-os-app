# Siri → Mafer OS (Atajos de iPhone)

Dos atajos para dictarle a Siri:

- **«Oye Siri, anota en Mafer OS»** → te pregunta qué anotar y lo guarda en **Inbox**.
- **«Oye Siri, evento en Mafer OS»** → te pregunta qué, qué día y a qué hora, y lo guarda en el **Calendario**. Si Google Calendar está conectado, también aparece ahí, como los demás eventos.

## Cómo funciona

Cada atajo manda la información a `https://mafer-os-app.vercel.app/api/siri/…` junto con una **clave secreta** (`SIRI_TOKEN`). Sin esa clave, la app responde «No autorizado». Estas rutas **solo pueden crear** cosas: no pueden leer, editar ni borrar nada.

La clave vive en dos lugares: en Vercel (variable de entorno `SIRI_TOKEN`) y dentro de tus atajos. **No la compartas.** Si se filtra, genera otra, cámbiala en Vercel y en los dos atajos; la anterior deja de funcionar.

## Atajo 1: «Anota en Mafer OS»

En la app **Atajos** → **+** (nuevo atajo). Agrega estas acciones en orden:

1. **Pedir entrada** (Ask for Input)
   - Tipo: *Texto*
   - Pregunta: `¿Qué anoto?`
2. **Obtener contenido de URL** (Get Contents of URL)
   - URL: `https://mafer-os-app.vercel.app/api/siri/inbox`
   - Toca *Mostrar más*:
     - Método: **POST**
     - Encabezados → agregar: `Authorization` = `Bearer TU_CLAVE`
     - Cuerpo de la solicitud: **JSON** → agregar campo de *Texto*: `texto` = variable **Entrada proporcionada**
3. **Obtener valor del diccionario** (Get Dictionary Value)
   - Clave: `mensaje` · Diccionario: **Contenido de URL**
4. **Mostrar resultado** (Show Result) → **Valor del diccionario**
   - Siri lo lee en voz alta: «Listo, quedó en tu Inbox.»

Nombre del atajo: **Anota en Mafer OS** (así se lo dices a Siri).

## Atajo 2: «Evento en Mafer OS»

1. **Pedir entrada** → Tipo *Texto* → Pregunta: `¿Qué evento?`
2. **Establecer variable** → nombre `Titulo` → valor **Entrada proporcionada**
3. **Pedir entrada** → Tipo **Fecha y hora** → Pregunta: `¿Cuándo?`
   - Aquí puedes decir cosas como «mañana a las 5 de la tarde» o «el viernes a las 10».
4. **Formatear fecha** (Format Date) → Fecha: **Entrada proporcionada** → Formato: **ISO 8601** → activa *Incluir hora*
5. **Obtener contenido de URL**
   - URL: `https://mafer-os-app.vercel.app/api/siri/evento`
   - Método **POST** · Encabezado `Authorization` = `Bearer TU_CLAVE`
   - Cuerpo **JSON**:
     - `titulo` (Texto) = variable **Titulo**
     - `fecha` (Texto) = **Fecha formateada**
     - *(opcional)* `duracion` (Número) = `30`, `90`, etc. Si no lo pones, dura 60 minutos.
6. **Obtener valor del diccionario** → Clave `mensaje`
7. **Mostrar resultado** → **Valor del diccionario**
   - Siri lee algo como: «Listo, agendé «Dentista» el 2026-10-07 a las 17:30 y ya está en Google Calendar.»

Nombre del atajo: **Evento en Mafer OS**.

> Para un evento de **todo el día**, manda solo la fecha, sin hora: en el paso 4 usa el formato personalizado `yyyy-MM-dd`.

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

Respuestas: `200 { ok, mensaje }` · `400 { ok: false, mensaje }` (dato que no entendió) · `401` (clave incorrecta o `SIRI_TOKEN` sin configurar).

Código: `src/app/api/siri/*`, lógica y validación en `src/lib/siri-logic.ts`, pruebas en `tests/siri-logic.test.ts` y `e2e/siri.spec.ts`.
