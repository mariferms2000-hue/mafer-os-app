/* Reglas puras del cuidado del Jardín (F4): sed, Agua y Fertilizante. Sin base
   de datos ni React; la persistencia vive en care.ts.

   AGUA — hidratación relajada
   - El jardín tiene un reloj de sed. Cada THIRST_EVERY_DAYS días, UNA planta
     (la que lleva más tiempo sin regarse) empieza a tener sed.
   - Nunca hay más de MAX_THIRSTY con sed a la vez. Mientras haya ese tope, los
     días pasan sin acumular nada: ignorar el jardín no genera una pila de
     plantas sedientas esperando.
   - La sed solo cambia el aspecto (caída y apagada). No muere, no pierde
     minutos ni etapas, no hay avisos. 1 Agua la recupera al momento.
   - La planta especial nunca tiene sed (es el premio del Fertilizante).

   FERTILIZANTE — una planta especial
   - Solo en plantas completadas. 1 Fertilizante desbloquea para siempre la
     versión especial de ESA planta.
   - Solo una se luce como especial a la vez. Cambiar cuál se luce entre las ya
     fertilizadas es gratis, igual que quitarla: nunca se desperdicia
     Fertilizante por cambiar de idea.
   - Nunca toca minutos ni etapas. */

/** Cada cuántos días le da sed a UNA planta. 5 días = como mucho 1,4 riegos por
 *  semana, que el Agua de la bolsa (5 de cada 6 recompensas) cubre desde unas 6
 *  tareas por semana. */
export const THIRST_EVERY_DAYS = 5;
export const MAX_THIRSTY = 2;
const DAY_MS = 24 * 60 * 60 * 1000;
export const THIRST_INTERVAL_MS = THIRST_EVERY_DAYS * DAY_MS;

export type ThirstPlan = {
  /** nuevo valor del reloj (avanza en intervalos enteros, nunca se adelanta a `now`) */
  clock: string;
  /** cuántas plantas deben empezar a tener sed ahora */
  newlyThirsty: number;
};

/** Qué hacer con el reloj de sed al abrir el jardín.
 *  - Sin reloj (primera vez): arranca ahora y nada tiene sed todavía.
 *  - Reloj ilegible: se reinicia ahora, sin castigo.
 *  - Pasaron `ticks` intervalos: el reloj avanza esos intervalos y se marcan
 *    como mucho los que quepan bajo el tope; el resto se descarta.
 *  null = no pasó ningún intervalo completo; no hay nada que guardar. */
export function planThirst(clock: string | null | undefined, now: Date, thirstyNow: number): ThirstPlan | null {
  const nowMs = now.getTime();
  const start = clock ? Date.parse(clock) : Number.NaN;
  if (!Number.isFinite(start) || start > nowMs) return { clock: now.toISOString(), newlyThirsty: 0 };
  const ticks = Math.floor((nowMs - start) / THIRST_INTERVAL_MS);
  if (ticks < 1) return null;
  const room = Math.max(0, MAX_THIRSTY - Math.max(0, thirstyNow));
  return {
    clock: new Date(start + ticks * THIRST_INTERVAL_MS).toISOString(),
    newlyThirsty: Math.min(ticks, room),
  };
}

export type CareCandidate = {
  id: string;
  /** último riego; si nunca se regó, cuándo llegó al jardín */
  lastCare: string;
  thirsty: boolean;
};

/** A quién le toca la sed: las que no tienen sed ni son la especial, de la que
 *  lleva más tiempo sin cuidado a la más reciente (empate: por id, estable). */
export function pickThirsty(candidates: readonly CareCandidate[], n: number, specialId: string | null): string[] {
  if (n <= 0) return [];
  return candidates
    .filter((c) => !c.thirsty && c.id !== specialId)
    .sort((a, b) => (a.lastCare === b.lastCare ? a.id.localeCompare(b.id) : a.lastCare < b.lastCare ? -1 : 1))
    .slice(0, n)
    .map((c) => c.id);
}

/** Estado de cuidado de una planta tal como lo ve la interfaz. */
export type PlantCare = {
  thirsty: boolean;
  /** ya tiene su versión especial desbloqueada */
  fertilized: boolean;
  /** es LA planta especial que se luce ahora */
  special: boolean;
};

export const NO_CARE: PlantCare = { thirsty: false, fertilized: false, special: false };

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
