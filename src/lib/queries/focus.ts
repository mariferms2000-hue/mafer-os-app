import { count, desc, eq, isNull, isNotNull } from "drizzle-orm";
import { db, today, schema } from "@/lib/db";
import { plantStage, nextStageInfo, type StageKey } from "@/lib/focus-logic";
import { getTodayData } from "@/lib/queries/today";

/* Consulta de solo lectura para Focus Garden — Fase 7B.
   Devuelve todo lo que la futura UI (7C/7D) necesita en una sola llamada:
   sesión abierta (recuperable), planta actual con etapa derivada, minutos de
   hoy y el jardín (plantas completadas). No modifica nada. */

export type FocusOverview = {
  openSession: (typeof schema.focusSessions.$inferSelect & { cardTitle: string | null }) | null;
  plant: {
    id: string;
    species: string;
    accumulatedMinutes: number;
    stage: StageKey;
    next: { key: StageKey; missingMinutes: number } | null;
  } | null;
  todayMinutes: number;
  garden: { id: string; species: string; startedAt: string; completedAt: string | null }[];
};

/** Opciones para elegir tarea al empezar (Fase 7D): la sugerencia real de
 *  «Haz esto ahora» primero, luego las 3 prioridades del día — nunca una
 *  lista extensa. `preselect` resuelve el título cuando se llega con
 *  una tarea concreta (desde el hero o el detalle). Solo lectura. */
export type FocusPickerOption = { id: string; title: string };

export async function getFocusPicker(preselectId?: string | null): Promise<{
  suggested: FocusPickerOption | null;
  priorities: FocusPickerOption[];
  preselect: FocusPickerOption | null;
}> {
  const data = await getTodayData();
  const suggestedCard = data.doNow[0]?.card ?? null;
  const priorities = data.priorities
    .filter((p) => !p.completedAt)
    .map((p) => ({ id: p.id, title: p.title }));

  let preselect: FocusPickerOption | null = null;
  if (preselectId) {
    const [card] = await db
      .select({ id: schema.cards.id, title: schema.cards.title })
      .from(schema.cards)
      .where(eq(schema.cards.id, preselectId))
      .limit(1);
    preselect = card ?? null;
  }

  return {
    suggested: suggestedCard ? { id: suggestedCard.id, title: suggestedCard.title } : null,
    priorities,
    preselect,
  };
}

/** Datos de la vista «Mi jardín» (Fase 7E.3). Solo lectura: la planta actual con
 *  su identidad completa y etapa derivada, y las completadas (más reciente
 *  primero) con paginación simple por límite. Nunca modifica nada. */
export type GardenPlant = {
  id: string;
  species: string;
  visualSeed: number;
  rendererVersion: number;
  accumulatedMinutes: number;
  startedAt: string;
  completedAt: string | null;
};

export type GardenData = {
  current: (GardenPlant & { stage: StageKey; next: { key: StageKey; missingMinutes: number } | null }) | null;
  completed: GardenPlant[];
  totalCompleted: number;
};

export async function getGarden(limit = 12): Promise<GardenData> {
  const [current] = await db
    .select()
    .from(schema.focusPlants)
    .where(isNull(schema.focusPlants.completedAt))
    .limit(1);

  const completed = await db
    .select()
    .from(schema.focusPlants)
    .where(isNotNull(schema.focusPlants.completedAt))
    .orderBy(desc(schema.focusPlants.completedAt))
    .limit(Math.max(1, limit));

  const [total] = await db
    .select({ n: count() })
    .from(schema.focusPlants)
    .where(isNotNull(schema.focusPlants.completedAt))
    .limit(1);

  return {
    current: current
      ? {
          id: current.id,
          species: current.species,
          visualSeed: current.visualSeed,
          rendererVersion: current.rendererVersion,
          accumulatedMinutes: current.accumulatedMinutes,
          startedAt: current.startedAt,
          completedAt: current.completedAt,
          stage: plantStage(current.accumulatedMinutes),
          next: nextStageInfo(current.accumulatedMinutes),
        }
      : null,
    completed: completed.map((p) => ({
      id: p.id,
      species: p.species,
      visualSeed: p.visualSeed,
      rendererVersion: p.rendererVersion,
      accumulatedMinutes: p.accumulatedMinutes,
      startedAt: p.startedAt,
      completedAt: p.completedAt,
    })),
    totalCompleted: total?.n ?? 0,
  };
}

export async function getFocusOverview(): Promise<FocusOverview> {
  const [open] = await db
    .select()
    .from(schema.focusSessions)
    .where(isNull(schema.focusSessions.finishedAt))
    .limit(1);

  let cardTitle: string | null = null;
  if (open?.cardId) {
    const [card] = await db
      .select({ title: schema.cards.title })
      .from(schema.cards)
      .where(eq(schema.cards.id, open.cardId))
      .limit(1);
    cardTitle = card?.title ?? null;
  }

  const [plant] = await db
    .select()
    .from(schema.focusPlants)
    .where(isNull(schema.focusPlants.completedAt))
    .limit(1);

  // Acumulado de hoy: la suma de lo ya abonado en sesiones cerradas de esta fecha.
  const todaySessions = await db
    .select({ credited: schema.focusSessions.creditedMinutes })
    .from(schema.focusSessions)
    .where(eq(schema.focusSessions.date, today()));
  const todayMinutes = todaySessions.reduce((sum, s) => sum + (s.credited ?? 0), 0);

  const garden = await db
    .select({
      id: schema.focusPlants.id,
      species: schema.focusPlants.species,
      startedAt: schema.focusPlants.startedAt,
      completedAt: schema.focusPlants.completedAt,
    })
    .from(schema.focusPlants)
    .where(isNotNull(schema.focusPlants.completedAt))
    .orderBy(desc(schema.focusPlants.completedAt));

  return {
    openSession: open ? { ...open, cardTitle } : null,
    plant: plant
      ? {
          id: plant.id,
          species: plant.species,
          accumulatedMinutes: plant.accumulatedMinutes,
          stage: plantStage(plant.accumulatedMinutes),
          next: nextStageInfo(plant.accumulatedMinutes),
        }
      : null,
    todayMinutes,
    garden,
  };
}
