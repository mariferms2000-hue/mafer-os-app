import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { CalendarCheck2 } from "lucide-react";
import { db, today, schema } from "@/lib/db";
import { getSetting } from "@/lib/auth";
import { getOpenReview, getReviewCenter } from "@/lib/queries/reviews";
import { DAILY_STEPS, DAILY_STEP_TITLES } from "@/lib/review-logic";
import { humanDate } from "@/lib/project-health";
import { diasEntre, recommendNow } from "@/lib/recommend";
import { PageHeader } from "@/components/ui/page-header";
import { InboxList } from "@/components/inbox/inbox-list";
import { Priorities, EnergySelector } from "@/components/hoy/priorities";
import { TaskLine } from "@/components/hoy/task-line";
import { ReviewShell, ReviewTaskRow, StartReviewButton } from "@/components/reviews/review-ui";
import type { CardRow } from "@/lib/queries/today";

export const dynamic = "force-dynamic";
export const metadata = { title: "Revisión diaria" };

const INTROS = [
  "Hay algunas capturas esperando destino. No necesitas procesarlas todas — «dejar para después» está perfecto.",
  "Solo lo que pide una decisión hoy. Reprogramar también es avanzar.",
  "Tus tres focos del día. Confírmalos, cámbialos o déjalos como están.",
  "Esto solo ajusta las sugerencias — tus prioridades manuales no se tocan.",
  "Un vistazo a cómo quedó el día y cuál será el primer paso al volver.",
];

export default async function RevisionDiariaPage({
  searchParams,
}: {
  searchParams: Promise<{ paso?: string }>;
}) {
  const { paso: pasoParam } = await searchParams;
  const session = await getOpenReview("diaria");
  const d = today();

  if (!session) {
    const c = await getReviewCenter();
    return (
      <div className="max-w-2xl">
        <PageHeader
          icon={CalendarCheck2}
          title="Revisión diaria"
          intro="Cinco minutos para que nada se caiga: Inbox, tareas del día, prioridades, energía y cierre."
        />
        <div className="card p-5">
          <p className="text-sm text-stone mb-3">
            Última vez: {c.daily.lastCompleted ? humanDate(c.daily.lastCompleted.finishedAt, d) : "nunca — la primera es la que más ayuda"}.
          </p>
          <StartReviewButton tipo="diaria" label="Empezar revisión (5 min)" />
        </div>
      </div>
    );
  }

  const paso = Math.min(Math.max(1, Number(pasoParam) || session.step), DAILY_STEPS);

  // Datos del paso actual
  let contenido: React.ReactNode = null;

  if (paso === 1) {
    const pendientes = await db
      .select()
      .from(schema.inboxItems)
      .where(eq(schema.inboxItems.processed, false))
      .orderBy(desc(schema.inboxItems.createdAt));
    const projects = await db
      .select({ id: schema.projects.id, title: schema.projects.title })
      .from(schema.projects)
      .where(eq(schema.projects.archived, false))
      .orderBy(asc(schema.projects.title));
    contenido =
      pendientes.length === 0 ? (
        <p className="text-sm text-stone" data-testid="step-empty">Inbox en cero. Nada que procesar hoy. 🌿</p>
      ) : (
        <>
          <InboxList items={pendientes.slice(0, 5)} projects={projects} />
          {pendientes.length > 5 && (
            <p className="text-xs text-stone">
              Hay {pendientes.length - 5} más.{" "}
              <Link href="/inbox" className="underline underline-offset-4 hover:text-forest">Ver más en el Inbox</Link>
              {" "}— o sigue con la revisión, no pasa nada.
            </p>
          )}
        </>
      );
  } else if (paso === 2) {
    const rows = await db
      .select({ card: schema.cards, projectTitle: schema.projects.title, columnKind: schema.columns.kind })
      .from(schema.cards)
      .leftJoin(schema.projects, eq(schema.cards.projectId, schema.projects.id))
      .leftJoin(schema.columns, eq(schema.cards.columnId, schema.columns.id));
    const open = rows
      .map((r) => ({ ...r.card, projectTitle: r.projectTitle, columnKind: r.columnKind }) as CardRow)
      .filter((c) => !c.completedAt && !c.archived);
    const conRazon: { card: CardRow; reason: string }[] = [];
    const visto = new Set<string>();
    const añade = (c: CardRow, reason: string) => {
      if (visto.has(c.id)) return;
      visto.add(c.id);
      conRazon.push({ card: c, reason });
    };
    for (const c of open) if (c.dueDate && c.dueDate < d) añade(c, `Venció el ${c.dueDate}`);
    for (const c of open) if (c.dueDate === d) añade(c, "Vence hoy");
    for (const c of open)
      if ((c.waitingFor || c.columnKind === "esperando") && diasEntre(c.updatedAt, d) >= 7)
        añade(c, `Esperando hace ${diasEntre(c.updatedAt, d)} días`);
    for (const c of open) if (c.blockedReason || c.columnKind === "bloqueado") añade(c, "Bloqueada — ¿ya se destrabó?");
    contenido =
      conRazon.length === 0 ? (
        <p className="text-sm text-stone" data-testid="step-empty">Nada vencido ni urgente. Día despejado. 🌿</p>
      ) : (
        <>
          <p className="text-sm text-stone">
            Hay {conRazon.length === 1 ? "una cosa" : `${Math.min(conRazon.length, 5)} cosas`} que conviene revisar.
          </p>
          {conRazon.slice(0, 5).map(({ card, reason }) => (
            <ReviewTaskRow key={card.id} card={card} reason={reason} sessionId={session.id} />
          ))}
          {conRazon.length > 5 && (
            <p className="text-xs text-stone">
              Hay {conRazon.length - 5} más.{" "}
              <Link href="/tareas?v=hoy" className="underline underline-offset-4 hover:text-forest">Ver más en Tareas</Link>
            </p>
          )}
        </>
      );
  } else if (paso === 3) {
    const priorityRows = await db
      .select()
      .from(schema.todayPriorities)
      .where(eq(schema.todayPriorities.date, d))
      .orderBy(asc(schema.todayPriorities.position));
    const rows = await db
      .select({ card: schema.cards, projectTitle: schema.projects.title, columnKind: schema.columns.kind })
      .from(schema.cards)
      .leftJoin(schema.projects, eq(schema.cards.projectId, schema.projects.id))
      .leftJoin(schema.columns, eq(schema.cards.columnId, schema.columns.id));
    const all = rows.map((r) => ({ ...r.card, projectTitle: r.projectTitle, columnKind: r.columnKind }) as CardRow);
    const byId = new Map(all.map((c) => [c.id, c]));
    const priorities = priorityRows.map((p) => byId.get(p.cardId)).filter((c): c is CardRow => Boolean(c));
    const candidates = all.filter(
      (c) => !c.completedAt && !c.archived && c.columnKind !== "despues" && c.columnKind !== "bloqueado" && !c.blockedReason
    );
    contenido = <Priorities priorities={priorities} candidates={candidates.slice(0, 60)} />;
  } else if (paso === 4) {
    const energia = (await getSetting(`energy:${d}`)) ?? "";
    contenido = (
      <div className="card p-5">
        <p className="text-base font-medium mb-2">¿Cómo está tu energía hoy?</p>
        <EnergySelector current={energia} />
      </div>
    );
  } else {
    // Paso 5 — cierre
    const inicioDia = `${d}T00:00:00`;
    const rows = await db
      .select({ card: schema.cards, projectTitle: schema.projects.title, columnKind: schema.columns.kind })
      .from(schema.cards)
      .leftJoin(schema.projects, eq(schema.cards.projectId, schema.projects.id))
      .leftJoin(schema.columns, eq(schema.cards.columnId, schema.columns.id));
    const all = rows.map((r) => ({ ...r.card, projectTitle: r.projectTitle, columnKind: r.columnKind }) as CardRow);
    const completadasHoy = all.filter((c) => c.completedAt && c.completedAt >= inicioDia);
    const abiertas = all.filter((c) => !c.completedAt && !c.archived);
    const pendientesHoy = abiertas.filter((c) => c.dueDate && c.dueDate <= d);
    const energia = (await getSetting(`energy:${d}`)) ?? "";
    const priorityRows = await db
      .select()
      .from(schema.todayPriorities)
      .where(eq(schema.todayPriorities.date, d));
    const primerPaso = recommendNow({
      tasks: abiertas,
      dayEnergy: energia,
      priorityIds: priorityRows.map((p) => p.cardId),
      today: d,
      limit: 1,
    })[0];
    const primera = primerPaso ? all.find((c) => c.id === primerPaso.id) : undefined;
    const movidas = (
      await db.select({ id: schema.reviews.id, processed: schema.reviews.processed }).from(schema.reviews).where(eq(schema.reviews.id, session.id)).get()
    )?.processed ?? 0;

    contenido = (
      <div className="flex flex-col gap-4" data-testid="daily-close">
        <div className="card p-4">
          <p className="label">Se terminó hoy</p>
          {completadasHoy.length === 0 ? (
            <p className="text-sm text-stone">Nada todavía — y está bien. Mañana es otro día.</p>
          ) : (
            <ul className="divide-y divide-beige">
              {completadasHoy.slice(0, 5).map((c) => (
                <li key={c.id}><TaskLine card={c} /></li>
              ))}
            </ul>
          )}
        </div>
        <div className="card p-4">
          <p className="label">Queda pendiente de hoy</p>
          <p className="text-sm text-stone">
            {pendientesHoy.length === 0
              ? "Nada con fecha de hoy sin resolver."
              : `${pendientesHoy.length} tarea${pendientesHoy.length !== 1 ? "s" : ""} — mañana las verás en «Haz esto ahora».`}
          </p>
          {movidas > 0 && <p className="text-xs text-stone-soft mt-1">Atendiste {movidas} elemento{movidas !== 1 ? "s" : ""} en esta revisión.</p>}
        </div>
        {primera && (
          <div className="card p-4 !border-sage-deep">
            <p className="label">Tu primer paso al volver</p>
            <p className="text-sm font-medium text-ink-green" data-testid="first-step-back">{primera.title}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <ReviewShell
      sessionId={session.id}
      tipo="diaria"
      paso={paso}
      total={DAILY_STEPS}
      titulos={DAILY_STEP_TITLES}
      intro={INTROS[paso - 1]}
    >
      {contenido}
    </ReviewShell>
  );
}
