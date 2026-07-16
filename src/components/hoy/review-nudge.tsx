import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { getReviewCenter } from "@/lib/queries/reviews";
import { humanDate } from "@/lib/project-health";
import { StartReviewButton } from "@/components/reviews/review-ui";

/** Acceso compacto a Revisiones desde Hoy, con UN solo aviso como máximo.
 *  Prioridad: revisión incompleta > semanal pendiente > diaria pendiente. */
export async function ReviewNudge() {
  const c = await getReviewCenter();

  const filaDiaria = (
    <div className="flex items-center gap-2 py-1.5" data-testid="nudge-diaria">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Revisión diaria</p>
        <p className="text-xs text-stone">
          5 minutos · Última: {c.daily.lastCompleted ? humanDate(c.daily.lastCompleted.finishedAt, c.today) : "nunca"}
        </p>
      </div>
      {c.nudge === "continuar-diaria" && c.daily.open ? (
        <Link href={`/revisiones/diaria?paso=${c.daily.open.step}`} className="btn btn-primary !py-1.5 !px-3 text-xs shrink-0" data-testid="nudge-cta">
          Continuar
        </Link>
      ) : c.nudge === "diaria" ? (
        <StartReviewButton tipo="diaria" label="Empezar" className="btn btn-primary !py-1.5 !px-3 text-xs shrink-0" />
      ) : (
        !c.daily.pending && <span className="chip chip-done !text-[11px] shrink-0">Hecha hoy</span>
      )}
    </div>
  );

  const filaSemanal = (
    <div className="flex items-center gap-2 py-1.5" data-testid="nudge-semanal">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Revisión semanal</p>
        <p className="text-xs text-stone">
          15–20 minutos ·{" "}
          {c.weekly.open
            ? `a la mitad (paso ${c.weekly.open.step})`
            : c.weekly.pending
              ? "Pendiente esta semana"
              : "Hecha esta semana"}
        </p>
      </div>
      {c.nudge === "continuar-semanal" && c.weekly.open ? (
        <Link href={`/revisiones/semanal?paso=${c.weekly.open.step}`} className="btn btn-primary !py-1.5 !px-3 text-xs shrink-0" data-testid="nudge-cta">
          Continuar
        </Link>
      ) : c.nudge === "semanal" ? (
        <StartReviewButton tipo="semanal" label="Empezar" className="btn btn-primary !py-1.5 !px-3 text-xs shrink-0" />
      ) : (
        !c.weekly.pending && !c.weekly.open && <span className="chip chip-done !text-[11px] shrink-0">Al día</span>
      )}
    </div>
  );

  return (
    <section aria-labelledby="revisiones-hoy" className="card p-4" data-testid="review-nudge">
      <div className="flex items-center justify-between mb-1">
        <h2 id="revisiones-hoy" className="text-base text-forest-deep flex items-center gap-2">
          <RotateCcw size={15} className="text-olive" aria-hidden /> Revisiones
        </h2>
        <Link href="/revisiones" className="text-xs text-stone hover:text-forest underline-offset-4 hover:underline">
          Ver todo
        </Link>
      </div>
      <div className="divide-y divide-beige">
        {filaDiaria}
        {filaSemanal}
      </div>
    </section>
  );
}
