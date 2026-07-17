import "server-only";
import { and, desc, eq, isNull, isNotNull } from "drizzle-orm";
import { db, today, schema } from "@/lib/db";
import { getSetting } from "@/lib/auth";
import { dailyPending, weeklyPending, reviewNudge, type ReviewNudgeKind } from "@/lib/review-logic";

export type ReviewRow = typeof schema.reviews.$inferSelect;

export type ReviewCenter = {
  today: string;
  weeklyDay: number | null;
  daily: { open: ReviewRow | null; lastCompleted: ReviewRow | null; pending: boolean };
  weekly: { open: ReviewRow | null; lastCompleted: ReviewRow | null; pending: boolean };
  nudge: ReviewNudgeKind | null;
  history: ReviewRow[];
};

async function openSession(type: string): Promise<ReviewRow | null> {
  const [row] = await db
    .select()
    .from(schema.reviews)
    .where(and(eq(schema.reviews.type, type), isNull(schema.reviews.finishedAt)))
    .limit(1);
  return row ?? null;
}

async function lastCompleted(type: string): Promise<ReviewRow | null> {
  const [row] = await db
    .select()
    .from(schema.reviews)
    .where(and(eq(schema.reviews.type, type), eq(schema.reviews.completed, true)))
    .orderBy(desc(schema.reviews.finishedAt))
    .limit(1);
  return row ?? null;
}

export async function getOpenReview(type: "diaria" | "semanal"): Promise<ReviewRow | null> {
  return openSession(type);
}

export async function getReviewCenter(): Promise<ReviewCenter> {
  const d = today();
  const dayRaw = (await getSetting("review:weekly-day")) ?? "";
  const weeklyDay = dayRaw === "" ? null : Number(dayRaw);

  const [dailyOpen, weeklyOpen, dailyLast, weeklyLast] = await Promise.all([
    openSession("diaria"),
    openSession("semanal"),
    lastCompleted("diaria"),
    lastCompleted("semanal"),
  ]);

  const dailyIsPending = dailyPending(d, dailyLast?.date ?? null);
  const weeklyIsPending = weeklyPending(d, weeklyLast?.date ?? null, weeklyDay);

  const history = await db
    .select()
    .from(schema.reviews)
    .where(isNotNull(schema.reviews.finishedAt))
    .orderBy(desc(schema.reviews.finishedAt))
    .limit(5);

  return {
    today: d,
    weeklyDay,
    daily: { open: dailyOpen, lastCompleted: dailyLast, pending: dailyIsPending },
    weekly: { open: weeklyOpen, lastCompleted: weeklyLast, pending: weeklyIsPending },
    nudge: reviewNudge({
      unfinishedDaily: Boolean(dailyOpen),
      unfinishedWeekly: Boolean(weeklyOpen),
      dailyIsPending,
      weeklyIsPending,
    }),
    history,
  };
}
