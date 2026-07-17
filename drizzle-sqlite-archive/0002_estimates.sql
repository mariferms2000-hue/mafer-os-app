-- Fase 2: normalización de duración estimada y energía requerida de las tarjetas.
-- Mapeo documentado (ver src/lib/estimates.ts):
--   5m → under_10 · 15m → ten_to_30 · 30m → ten_to_30 · 60m → thirty_to_60 · deep → over_60
--   baja → low · media → medium · alta → high · NULL/vacío se mantiene como «sin estimar»
-- No se pierde información: cada valor antiguo tiene destino y los desconocidos no se tocan.
UPDATE cards SET duration = 'under_10' WHERE duration = '5m';--> statement-breakpoint
UPDATE cards SET duration = 'ten_to_30' WHERE duration IN ('15m', '30m');--> statement-breakpoint
UPDATE cards SET duration = 'thirty_to_60' WHERE duration = '60m';--> statement-breakpoint
UPDATE cards SET duration = 'over_60' WHERE duration = 'deep';--> statement-breakpoint
UPDATE cards SET energy = 'low' WHERE energy = 'baja';--> statement-breakpoint
UPDATE cards SET energy = 'medium' WHERE energy = 'media';--> statement-breakpoint
UPDATE cards SET energy = 'high' WHERE energy = 'alta';
