/* Reglas puras del cuidado del Jardín (F4): sed, Agua y Fertilizante. Sin base
   de datos ni React; la persistencia vive en care.ts.

   AGUA — cada planta tiene su propia sed
   - Regar deja una planta hidratada durante un tiempo; al acabarse, tiene sed.
     Todas las plantas (completadas y la actual) pueden tener sed a la vez.
   - El tiempo hidratada crece con el tamaño del jardín para que la demanda
     total no pase de MAX_WATERINGS_PER_WEEK: con 8 plantas o menos dura
     HYDRATED_DAYS días; con 16, el doble. Así un jardín grande pide Agua
     seguido, pero nunca se vuelve imposible tenerlo bonito.
   - Cada planta se desfasa unas horas según su semilla: la sed llega
     escalonada, no todas el mismo día.
   - La sed solo cambia el aspecto (caída, seca, apagada). No muere, no pierde
     minutos ni etapas, no hay avisos. 1 Agua la recupera al momento.
   - Recién regada (FRESH_HOURS) se ve más viva: rocío y tierra mojada.
   - La planta especial nunca tiene sed (es el premio del Fertilizante).
   - Al estrenar el cuidado nadie empieza sediento: el reloj de cada planta
     cuenta desde `careSince` si llegó antes.

   FERTILIZANTE — una planta especial
   - Solo en plantas completadas. 1 Fertilizante desbloquea para siempre la
     versión especial de ESA planta.
   - Solo una se luce como especial a la vez. Cambiar cuál se luce entre las ya
     fertilizadas es gratis, igual que quitarla: nunca se desperdicia
     Fertilizante por cambiar de idea.
   - Nunca toca minutos ni etapas. */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Días que una planta se mantiene hidratada en un jardín de hasta
 *  WATER_CAP_PLANTS plantas. */
export const HYDRATED_DAYS = 7;
/** A partir de este tamaño el tiempo hidratado se alarga en proporción. */
export const WATER_CAP_PLANTS = 8;
/** Riegos semanales que pide un jardín bien cuidado, como máximo. */
export const MAX_WATERINGS_PER_WEEK = (WATER_CAP_PLANTS * 7) / HYDRATED_DAYS;
/** Desfase máximo por planta, para que la sed llegue escalonada. */
export const STAGGER_HOURS = 36;
/** Cuánto dura el aspecto «recién regada». */
export const FRESH_HOURS = 24;

/** Días hidratada según el tamaño del jardín. */
export function hydratedDays(plants: number): number {
  return HYDRATED_DAYS * Math.max(1, plants / WATER_CAP_PLANTS);
}

/** Desfase estable de una planta (0 a STAGGER_HOURS), según su semilla visual. */
export function staggerMs(seed: number): number {
  const x = Math.abs(Math.trunc(seed)) % 997;
  return Math.round((x / 996) * STAGGER_HOURS * HOUR_MS);
}

export type ThirstInput = {
  id: string;
  seed: number;
  /** cuándo llegó al jardín: completed_at (completadas) o started_at (la actual) */
  arrivedAt: string;
  wateredAt: string | null;
  thirsty: boolean;
};

/** Cuándo le toca la sed a una planta (ISO). */
export function thirstDueAt(p: ThirstInput, plants: number, careSince: string | null): string {
  const times = [p.wateredAt ?? p.arrivedAt, careSince].filter((t): t is string => !!t).map((t) => Date.parse(t)).filter(Number.isFinite);
  const from = times.length ? Math.max(...times) : Date.now();
  return new Date(from + hydratedDays(plants) * DAY_MS + staggerMs(p.seed)).toISOString();
}

/** Plantas que ya deberían tener sed y aún no la tienen, con la hora en que
 *  empezó (para que el registro cuente la historia real). */
export function dueThirst(plants: readonly ThirstInput[], now: Date, careSince: string | null, specialId: string | null): { id: string; since: string }[] {
  const n = plants.length;
  const t = now.getTime();
  return plants
    .filter((p) => !p.thirsty && p.id !== specialId)
    .map((p) => ({ id: p.id, since: thirstDueAt(p, n, careSince) }))
    .filter((x) => Date.parse(x.since) <= t);
}

/** ¿Se regó hace poco? */
export function isFresh(wateredAt: string | null, now: Date): boolean {
  if (!wateredAt) return false;
  const w = Date.parse(wateredAt);
  return Number.isFinite(w) && now.getTime() - w < FRESH_HOURS * HOUR_MS && now.getTime() >= w;
}

/** Estado de cuidado de una planta tal como lo ve la interfaz. */
export type PlantCare = {
  thirsty: boolean;
  /** recién regada: se ve más viva por unas horas */
  fresh: boolean;
  /** ya tiene su versión especial desbloqueada */
  fertilized: boolean;
  /** es LA planta especial que se luce ahora */
  special: boolean;
};

export const NO_CARE: PlantCare = { thirsty: false, fresh: false, fertilized: false, special: false };

/** Qué puede hacerse con una planta, para que la interfaz no lo adivine. */
export type CareOptions = {
  canWater: boolean;
  /** usar Fertilizante (cuesta 1) */
  canFertilize: boolean;
  /** lucirla como especial sin costo (ya estaba fertilizada) */
  canFeature: boolean;
  canUnfeature: boolean;
};

export function careOptions(care: PlantCare, completed: boolean, inventory: { agua: number; fertilizante: number }): CareOptions {
  return {
    canWater: care.thirsty && !care.special && inventory.agua > 0,
    canFertilize: completed && !care.fertilized && inventory.fertilizante > 0,
    canFeature: completed && care.fertilized && !care.special,
    canUnfeature: care.special,
  };
}
