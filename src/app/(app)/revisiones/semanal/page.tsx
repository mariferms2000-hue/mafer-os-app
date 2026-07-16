import Link from "next/link";
import { asc, eq, inArray } from "drizzle-orm";
import { CalendarRange } from "lucide-react";
import { db, today, schema } from "@/lib/db";
import { getSetting } from "@/lib/auth";
import { getOpenReview, getReviewCenter } from "@/lib/queries/reviews";
import { getProjectsOverview } from "@/lib/queries/projects";
import { WEEKLY_STEPS, WEEKLY_STEP_TITLES } from "@/lib/review-logic";
import { humanDate } from "@/lib/project-health";
import { diasEntre, recommendNow } from "@/lib/recommend";
import { PageHeader } from "@/components/ui/page-header";
import { TaskLine } from "@/components/hoy/task-line";
import { MarkPriorityButton } from "@/components/tasks/priority-button";
import {
  ReviewShell, ReviewTaskRow, ReviewProjectRow, ReviewIdeaRow, ReviewLearnRow, ReviewResourceRow, StartReviewButton,
} from "@/components/reviews/review-ui";
import type { CardRow } from "@/lib/queries/today";

export const dynamic = "force-dynamic";
export const metadata = { title: "Revisión semanal" };

const INTROS = [
  "Proyectos que piden algo. Pausar o archivar también es cuidarlos.",
  "Tareas que se están quedando atrás. Decidir «después» cuenta como decidir.",
  "Ideas guardadas hace tiempo. Ninguna se convierte en nada sin tu permiso.",
  "Tus temas de aprendizaje. ¿Cuál sigue vivo de verdad?",
  "Cosas guardadas «para leer después». Hoy es un buen después.",
  "Un vistazo a la semana que viene. Tú eliges las prioridades — nada se marca solo.",
];

async function openCards(): Promise<CardRow[]> {
  const rows = await db
    .select({ card: schema.cards, projectTitle: schema.projects.title, columnKind: schema.columns.kind })
    .from(schema.cards)
    .leftJoin(schema.projects, eq(schema.cards.projectId, schema.projects.id))
    .leftJoin(schema.columns, eq(schema.cards.columnId, schema.columns.id));
  return rows
    .map((r) => ({ ...r.card, projectTitle: r.projectTitle, columnKind: r.columnKind }) as CardRow)
    .filter((c) => !c.archived);
}

export default async function RevisionSemanalPage({
  searchParams,
}: {
  searchParams: Promise<{ paso?: string }>;
}) {
  const { paso: pasoParam } = await searchParams;
  const session = await getOpenReview("semanal");
  const d = today();

  if (!session) {
    const c = await getReviewCenter();
    return (
      <div className="max-w-2xl">
        <PageHeader
          icon={CalendarRange}
          title="Revisión semanal"
          intro="15–20 minutos para limpiar, decidir y preparar la semana: proyectos, tareas, ideas, aprendizajes y recursos."
        />
        <div className="card p-5">
          <p className="text-sm text-stone mb-3">
            Última vez: {c.weekly.lastCompleted ? humanDate(c.weekly.lastCompleted.finishedAt, d) : "nunca — empieza cuando quieras"}.
          </p>
          <StartReviewButton tipo="semanal" label="Empezar revisión (15–20 min)" />
        </div>
      </div>
    );
  }

  const paso = Math.min(Math.max(1, Number(pasoParam) || session.step), WEEKLY_STEPS);
  let contenido: React.ReactNode = null;

  if (paso === 1) {
    const overview = await getProjectsOverview();
    const conProblemas = overview.filter(
      (o) => o.project.status === "activo" && !o.project.archived && o.issues.length > 0
    );
    contenido =
      conProblemas.length === 0 ? (
        <p className="text-sm text-stone" data-testid="step-empty">Todos tus proyectos activos están al día. 🌿</p>
      ) : (
        <>
          <p className="text-sm text-stone">
            {conProblemas.length === 1 ? "Un proyecto pide" : `${Math.min(conProblemas.length, 5)} proyectos piden`} atención.
          </p>
          {conProblemas.slice(0, 5).map((o) => (
            <ReviewProjectRow
              key={o.project.id}
              projectId={o.project.id}
              title={o.project.title}
              issues={o.issues.map((i) => i.label)}
              sessionId={session.id}
            />
          ))}
          {conProblemas.length > 5 && (
            <p className="text-xs text-stone">
              Hay {conProblemas.length - 5} más.{" "}
              <Link href="/proyectos?f=atencion" className="underline underline-offset-4 hover:text-forest">Ver todos</Link>
            </p>
          )}
        </>
      );
  } else if (paso === 2) {
    const open = (await openCards()).filter((c) => !c.completedAt);
    const conRazon: { card: CardRow; reason: string }[] = [];
    const visto = new Set<string>();
    const añade = (c: CardRow, reason: string) => {
      if (visto.has(c.id)) return;
      visto.add(c.id);
      conRazon.push({ card: c, reason });
    };
    for (const c of open) if (c.dueDate && c.dueDate < d) añade(c, `Venció el ${c.dueDate}`);
    for (const c of open) if (!c.projectId) añade(c, "Sin proyecto");
    for (const c of open) if (!c.duration && !c.energy) añade(c, "Sin estimar");
    for (const c of open) if (c.waitingFor || c.columnKind === "esperando") añade(c, "Esperando");
    for (const c of open) if (diasEntre(c.updatedAt, d) >= 14) añade(c, `${diasEntre(c.updatedAt, d)} días sin actividad`);
    contenido =
      conRazon.length === 0 ? (
        <p className="text-sm text-stone" data-testid="step-empty">Tus tareas están sorprendentemente en orden. 🌿</p>
      ) : (
        <>
          {conRazon.slice(0, 5).map(({ card, reason }) => (
            <ReviewTaskRow key={card.id} card={card} reason={reason} sessionId={session.id} showArchive />
          ))}
          {conRazon.length > 5 && (
            <p className="text-xs text-stone">
              Hay {conRazon.length - 5} más.{" "}
              <Link href="/tareas?v=todas" className="underline underline-offset-4 hover:text-forest">Ver más en Tareas</Link>
            </p>
          )}
        </>
      );
  } else if (paso === 3) {
    const ideas = await db
      .select()
      .from(schema.ideas)
      .where(inArray(schema.ideas.status, ["incubando", "algun-dia"]))
      .orderBy(asc(schema.ideas.updatedAt));
    const viejas = ideas.filter((i) => diasEntre(i.updatedAt, d) >= 14);
    const aMostrar = (viejas.length ? viejas : ideas).slice(0, 5);
    contenido =
      aMostrar.length === 0 ? (
        <p className="text-sm text-stone" data-testid="step-empty">La incubadora está vacía. Las ideas nuevas llegarán solas. 🌿</p>
      ) : (
        <>
          {viejas.length === 0 && (
            <p className="text-xs text-stone-soft">Ninguna lleva mucho sin revisarse; estas son las más antiguas.</p>
          )}
          {aMostrar.map((i) => (
            <ReviewIdeaRow key={i.id} id={i.id} title={i.title} sessionId={session.id} />
          ))}
          <p className="text-xs text-stone">
            <Link href="/explorar" className="underline underline-offset-4 hover:text-forest">Ver la incubadora completa</Link>
          </p>
        </>
      );
  } else if (paso === 4) {
    const topics = await db
      .select()
      .from(schema.learningTopics)
      .where(inArray(schema.learningTopics.status, ["idea", "activo", "pausado"]))
      .orderBy(asc(schema.learningTopics.updatedAt));
    contenido =
      topics.length === 0 ? (
        <p className="text-sm text-stone" data-testid="step-empty">Sin temas de aprendizaje activos por ahora. 🌿</p>
      ) : (
        <>
          {topics.slice(0, 5).map((topic) => {
            const dias = diasEntre(topic.updatedAt, d);
            const notas: string[] = [];
            if (topic.sprint?.goal) notas.push(`Sprint: ${topic.sprint.goal}`);
            if (topic.status === "pausado") notas.push("pausado");
            if (topic.status === "idea") notas.push("sin arrancar");
            if (dias >= 14) notas.push(`${dias} días sin revisión`);
            return (
              <ReviewLearnRow
                key={topic.id}
                id={topic.id}
                title={topic.title}
                status={topic.status}
                note={notas.join(" · ") || "activo"}
                sessionId={session.id}
              />
            );
          })}
        </>
      );
  } else if (paso === 5) {
    const recursos = await db
      .select()
      .from(schema.resources)
      .where(inArray(schema.resources.status, ["pendiente", "en-proceso"]))
      .orderBy(asc(schema.resources.createdAt));
    contenido =
      recursos.length === 0 ? (
        <p className="text-sm text-stone" data-testid="step-empty">Nada pendiente de consultar. 🌿</p>
      ) : (
        <>
          {recursos.slice(0, 5).map((r) => (
            <ReviewResourceRow key={r.id} id={r.id} title={r.title} url={r.url ?? ""} status={r.status ?? "pendiente"} sessionId={session.id} />
          ))}
          {recursos.length > 5 && (
            <p className="text-xs text-stone">
              Hay {recursos.length - 5} más.{" "}
              <Link href="/biblioteca/recursos" className="underline underline-offset-4 hover:text-forest">Ver todos</Link>
            </p>
          )}
        </>
      );
  } else {
    // Paso 6 — próxima semana
    const open = (await openCards()).filter((c) => !c.completedAt);
    const dentroDe7 = new Date(`${d}T12:00:00`);
    dentroDe7.setDate(dentroDe7.getDate() + 7);
    const en7 = dentroDe7.toLocaleDateString("en-CA");
    const proximas = open
      .filter((c) => c.dueDate && c.dueDate >= d && c.dueDate <= en7)
      .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1));
    const eventos = await db
      .select()
      .from(schema.events)
      .where(eq(schema.events.isStarter, false))
      .orderBy(asc(schema.events.date));
    const eventosSemana = eventos.filter((e) => e.date >= d && e.date <= en7);
    const vencidas = open.filter((c) => c.dueDate && c.dueDate < d);
    const overview = await getProjectsOverview();
    const prioritarios = overview.filter(
      (o) => o.project.status === "activo" && !o.project.archived && o.project.priority === "alta"
    );
    const energia = (await getSetting(`energy:${d}`)) ?? "";
    const sugeridas = recommendNow({ tasks: open, dayEnergy: energia, priorityIds: [], today: d, limit: 3 })
      .map((r) => open.find((c) => c.id === r.id))
      .filter((c): c is CardRow => Boolean(c));

    contenido = (
      <div className="flex flex-col gap-4" data-testid="weekly-close">
        <div className="card p-4">
          <p className="label">Fechas próximas (7 días)</p>
          {proximas.length === 0 && eventosSemana.length === 0 ? (
            <p className="text-sm text-stone">Semana sin fechas límite. Espacio para avanzar con calma.</p>
          ) : (
            <ul className="divide-y divide-beige text-sm">
              {eventosSemana.slice(0, 3).map((e) => (
                <li key={e.id} className="py-1.5">📅 {e.date} — {e.title}</li>
              ))}
              {proximas.slice(0, 5).map((c) => (
                <li key={c.id}><TaskLine card={c} /></li>
              ))}
            </ul>
          )}
        </div>
        {vencidas.length > 0 && (
          <div className="card p-4">
            <p className="label">Siguen vencidas</p>
            <p className="text-xs text-stone-soft mb-1">Sin drama: decide hacer, reagendar o soltar.</p>
            <ul className="divide-y divide-beige">
              {vencidas.slice(0, 3).map((c) => (
                <li key={c.id}><TaskLine card={c} /></li>
              ))}
            </ul>
          </div>
        )}
        {prioritarios.length > 0 && (
          <div className="card p-4">
            <p className="label">Proyectos prioritarios</p>
            <ul className="text-sm divide-y divide-beige">
              {prioritarios.slice(0, 3).map((o) => (
                <li key={o.project.id} className="py-1.5">
                  <Link href={`/proyectos/${o.project.id}?retomar=1`} className="underline underline-offset-4 hover:text-forest">
                    {o.project.title}
                  </Link>
                  {o.nextActionCard && !o.nextActionCompleted && (
                    <span className="text-stone"> — sigue: {o.nextActionCard.title}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="card p-4 !border-sage-deep" data-testid="suggested-priorities">
          <p className="label">Sugerencias de prioridades (tú decides)</p>
          {sugeridas.length === 0 ? (
            <p className="text-sm text-stone">Sin candidatas claras — elige desde Hoy cuando arranque la semana.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {sugeridas.map((c) => (
                <li key={c.id} className="flex items-center gap-2">
                  <span className="text-sm flex-1 min-w-0 truncate">{c.title}</span>
                  <MarkPriorityButton cardId={c.id} className="btn btn-ghost !py-1 !px-2 text-xs" />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  return (
    <ReviewShell
      sessionId={session.id}
      tipo="semanal"
      paso={paso}
      total={WEEKLY_STEPS}
      titulos={WEEKLY_STEP_TITLES}
      intro={INTROS[paso - 1]}
    >
      {contenido}
    </ReviewShell>
  );
}
