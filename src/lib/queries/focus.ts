import { desc, eq, isNull, isNotNull } from "drizzle-orm";
import { db, today, schema } from "@/lib/db";
import { plantStage, nextStageInfo, type StageKey } from "@/lib/focus-logic";

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

export async function getFocusOverview(): Promise<FocusOverview> {
  const open =
    (await db.select().from(schema.focusSessions).where(isNull(schema.focusSessions.finishedAt)).get()) ?? null;

  let cardTitle: string | null = null;
  if (open?.cardId) {
    const card = await db
      .select({ title: schema.cards.title })
      .from(schema.cards)
      .where(eq(schema.cards.id, open.cardId))
      .get();
    cardTitle = card?.title ?? null;
  }

  const plant =
    (await db.select().from(schema.focusPlants).where(isNull(schema.focusPlants.completedAt)).get()) ?? null;

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
