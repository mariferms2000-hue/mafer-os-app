import Link from "next/link";
import { RotateCcw, CalendarCheck2, CalendarRange, History } from "lucide-react";
import { getReviewCenter } from "@/lib/queries/reviews";
import { humanDate } from "@/lib/project-health";
import { DAILY_STEPS, WEEKLY_STEPS } from "@/lib/review-logic";
import { PageHeader } from "@/components/ui/page-header";
import { StartReviewButton, ContinueControls } from "@/components/reviews/review-ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Revisiones" };

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function duracionMin(startedAt: string, finishedAt: string | null): number | null {
  if (!finishedAt) return null;
  return Math.max(1, Math.round((new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 60_000));
}

export default async function RevisionesPage() {
  const c = await getReviewCenter();

  return (
    <div className="max-w-2xl">
      <PageHeader
        icon={RotateCcw}
        title="Revisiones"
        intro="Pequeños repasos guiados para que nada se caiga. Puedes salir a la mitad: tu progreso se guarda solo."
      />

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        {/* Diaria */}
        <section className="card p-5" data-testid="center-diaria">
          <h2 className="text-lg text-forest-deep flex items-center gap-2 mb-1">
            <CalendarCheck2 size={18} className="text-olive" aria-hidden /> Revisión diaria
          </h2>
          <p className="text-sm text-stone">
            5 minutos · Última: {c.daily.lastCompleted ? humanDate(c.daily.lastCompleted.finishedAt, c.today) : "nunca"}
          </p>
          <p className="text-xs text-stone-soft mt-0.5 mb-3">
            {c.daily.open
              ? `Quedó a la mitad — paso ${c.daily.open.step} de ${DAILY_STEPS}.`
              : c.daily.pending
                ? "Sugerida para hoy."
                : "Hecha hoy. Puedes repetirla si quieres."}
          </p>
          {c.daily.open ? (
            <ContinueControls tipo="diaria" sessionId={c.daily.open.id} step={c.daily.open.step} />
          ) : (
            <StartReviewButton tipo="diaria" label={c.daily.pending ? "Empezar (5 min)" : "Repetir revisión"} />
          )}
        </section>

        {/* Semanal */}
        <section className="card p-5" data-testid="center-semanal">
          <h2 className="text-lg text-forest-deep flex items-center gap-2 mb-1">
            <CalendarRange size={18} className="text-olive" aria-hidden /> Revisión semanal
          </h2>
          <p className="text-sm text-stone">
            15–20 minutos ·{" "}
            {c.weekly.open
              ? `a la mitad (paso ${c.weekly.open.step} de ${WEEKLY_STEPS})`
              : c.weekly.pending
                ? "Pendiente esta semana"
                : `Hecha esta semana (${humanDate(c.weekly.lastCompleted?.finishedAt ?? null, c.today)})`}
          </p>
          <p className="text-xs text-stone-soft mt-0.5 mb-3">
            {c.weeklyDay !== null
              ? `Tu día preferido: ${DIAS[c.weeklyDay]} (se cambia en Ajustes).`
              : "Cualquier día de la semana está bien (puedes fijar uno en Ajustes)."}
          </p>
          {c.weekly.open ? (
            <ContinueControls tipo="semanal" sessionId={c.weekly.open.id} step={c.weekly.open.step} />
          ) : (
            <StartReviewButton tipo="semanal" label={c.weekly.pending ? "Empezar (15–20 min)" : "Repetir revisión"} />
          )}
        </section>
      </div>

      {/* Historial simple: últimas 5 */}
      <section className="card p-5" data-testid="review-history">
        <h2 className="text-lg text-forest-deep flex items-center gap-2 mb-2">
          <History size={18} className="text-olive" aria-hidden /> Últimas revisiones
        </h2>
        {c.history.length === 0 ? (
          <p className="text-sm text-stone">Aquí aparecerán tus revisiones. La primera es la que más ayuda. 🌿</p>
        ) : (
          <ul className="divide-y divide-beige text-sm">
            {c.history.map((r) => {
              const mins = duracionMin(r.startedAt, r.finishedAt);
              return (
                <li key={r.id} className="py-2 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="font-medium capitalize">{r.type}</span>
                  <span className="text-stone">{humanDate(r.finishedAt, c.today)}</span>
                  <span className={`chip !text-[11px] ${r.completed ? "chip-done" : "chip-waiting"}`}>
                    {r.completed ? "completa" : "incompleta"}
                  </span>
                  {mins !== null && <span className="text-xs text-stone-soft">{mins} min</span>}
                  {r.processed > 0 && <span className="text-xs text-stone-soft">· {r.processed} elementos</span>}
                  {r.summary && <span className="text-xs text-stone-soft w-full">{r.summary}</span>}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="text-xs text-stone-soft mt-4">
        <Link href="/" className="underline underline-offset-4 hover:text-forest">Volver a Hoy</Link>
      </p>
    </div>
  );
}
