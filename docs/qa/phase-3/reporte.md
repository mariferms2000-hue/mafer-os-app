# QA — Fase 3: Hoy como sistema antiolvido y de enfoque (TDAH)

Fecha: 2026-07-14 · Base de pruebas: temporal (`e2e/.test-db`); la BD real no se toca en pruebas.

## Qué responde la página en <10 segundos

1. **«Haz esto ahora»** (arriba a la izquierda): UNA sola tarea recomendada, con el
   porqué en lenguaje claro («Porque es tu prioridad #1 de hoy · vence hoy · pide
   energía baja, como la tuya hoy»). Botones: **La terminé**, **Abrir tarea** y
   **Otra sugerencia** (rota entre las 3 mejores candidatas sin recargar).
2. **Para que nada se caiga** (arriba a la derecha): máximo 5 alertas antiolvido,
   ordenadas por urgencia, cada una lleva a la acción con un clic.

## Motor de recomendación (`src/lib/recommend.ts`, puro y con pruebas)

Reglas transparentes, sin cajas negras ni APIs externas:

| Señal | Peso | Razón mostrada |
| --- | --- | --- |
| Prioridad manual #1/#2/#3 | +100/+92/+84 | «es tu prioridad #N de hoy» |
| Vencida / vence hoy | +70 / +60 | «venció el …» / «vence hoy» |
| Energía día baja × tarea low | +25 (+12 si <10 min) | «pide energía baja…», «toma menos de 10 minutos» |
| Energía día baja × tarea high | −30 | (solo baja el puntaje) |
| Energía día media × tarea medium | +15 | «va bien con tu energía media» |
| Energía día alta × tarea high | +25 (+10 si >60 min) | «aprovecha tu energía alta», «es trabajo profundo» |
| Prioridad alta de la tarjeta | +12 | «la marcaste con prioridad alta» |

Nunca recomienda tareas bloqueadas, en espera ni pospuestas («Después»).

## Alertas antiolvido (`buildForgetAlerts`)

| Alerta | Umbral | A dónde lleva |
| --- | --- | --- |
| Tarea vencida | fecha < hoy | la tarea (o el filtro si son varias) |
| Esperando demasiado | ≥7 días sin tocar | la tarea |
| Proyecto activo sin siguiente acción | inmediato | el proyecto |
| Proyecto sin actividad reciente | ≥14 días | el proyecto (modo retomar) |
| Tarea de hoy sin duración o energía | fecha hoy o prioridad | la primera tarea |
| Captura sin procesar | la más antigua ≥3 días | el Inbox |

Límite global de 5 alertas y máximo 2 por tipo repetible, para no saturar.
Sin nada pendiente: una sola línea tranquila («Nada olvidado por hoy 🌿»).

## Lo que ya existía y se conserva en la misma página

Tus 3 prioridades manuales (intactas: la energía del día jamás las modifica),
agenda de hoy (eventos + fechas), «Menos de 30 minutos» ajustada a tu energía,
trabajo profundo con energía alta, siguiente paso por proyecto, bloqueado,
esperando, para después e Inbox sin procesar.

## Capturas

- `01-hoy-completa.png` — la página entera con recomendación y alertas.
- `02-haz-esto-ahora.png` — la tarjeta de recomendación con razones.
- `03-alertas.png` — alertas antiolvido.
- `04-movil-hoy.png` — Hoy en iPhone.

## Resultado de pruebas

Ver el resumen del commit: lint y TypeScript limpios, build ok, 32/32 unitarias
(motor de recomendación y alertas con todos los umbrales) y suite E2E completa
en Chrome, Safari/WebKit y viewport iPhone.
