import Link from "next/link";
import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import { CalendarDays, ChevronLeft, ChevronRight, CheckCircle2, Unplug } from "lucide-react";
import { db, today, schema } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { NewEventButton } from "@/components/calendar/new-event";
import { googleStatus } from "@/lib/google/calendar";
import { disconnectGoogleAction } from "@/lib/actions/google";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calendario" };

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DIAS_CORTOS = ["Lu","Ma","Mi","Ju","Vi","Sá","Do"];

type Occurrence = {
  id: string;
  date: string;
  time: string | null;
  title: string;
  kind: "evento" | "tarea";
  type: string;
  projectId: string | null;
  href?: string;
};

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; mes?: string; proyecto?: string; tipo?: string; google?: string }>;
}) {
  const { vista = "mes", mes, proyecto = "", tipo = "", google } = await searchParams;
  const hoy = today();
  const base = mes ? new Date(`${mes}-01T12:00:00`) : new Date();
  const year = base.getFullYear();
  const month = base.getMonth();

  const events = await db.select().from(schema.events).orderBy(asc(schema.events.date));
  const datedCards = await db
    .select()
    .from(schema.cards)
    .where(and(eq(schema.cards.archived, false), isNull(schema.cards.completedAt), isNotNull(schema.cards.dueDate)));
  const projects = await db
    .select({ id: schema.projects.id, title: schema.projects.title })
    .from(schema.projects)
    .where(eq(schema.projects.archived, false));
  const projectName = new Map(projects.map((p) => [p.id, p.title]));
  const gstatus = await googleStatus();

  let occ: Occurrence[] = [
    ...events.map((e) => ({
      id: `e-${e.id}`,
      date: e.date,
      time: e.startTime,
      title: e.title,
      kind: "evento" as const,
      type: e.type ?? "evento",
      projectId: e.projectId,
    })),
    ...datedCards.map((c) => ({
      id: `c-${c.id}`,
      date: c.dueDate!,
      time: c.startTime,
      title: c.title,
      kind: "tarea" as const,
      type: "tarea",
      projectId: c.projectId,
      href: c.projectId ? `/proyectos/${c.projectId}` : undefined,
    })),
  ];
  if (proyecto) occ = occ.filter((o) => o.projectId === proyecto);
  if (tipo) occ = occ.filter((o) => (tipo === "tareas" ? o.kind === "tarea" : o.kind === "evento" && o.type === tipo));

  const byDate = new Map<string, Occurrence[]>();
  for (const o of occ) byDate.set(o.date, [...(byDate.get(o.date) ?? []), o]);
  for (const list of byDate.values()) list.sort((a, b) => (a.time ?? "99") < (b.time ?? "99") ? -1 : 1);

  const prevMonth = iso(new Date(year, month - 1, 1)).slice(0, 7);
  const nextMonth = iso(new Date(year, month + 1, 1)).slice(0, 7);

  // Celdas del mes (semana empieza en lunes)
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array<null>(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => iso(new Date(year, month, i + 1))),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  // Semana actual (7 días desde hoy) y agenda (30 días)
  const upcoming: { date: string; items: Occurrence[] }[] = [];
  const horizon = vista === "semana" ? 7 : 30;
  for (let i = 0; i < horizon; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const key = iso(d);
    upcoming.push({ date: key, items: byDate.get(key) ?? [] });
  }

  const qs = (v: string, m?: string) =>
    `/calendario?vista=${v}${m ? `&mes=${m}` : ""}${proyecto ? `&proyecto=${proyecto}` : ""}${tipo ? `&tipo=${tipo}` : ""}`;

  return (
    <div>
      <PageHeader
        icon={CalendarDays}
        title="Calendario"
        intro="Tus reuniones, fechas límite y tareas con fecha, en un solo lugar."
      >
        <NewEventButton projects={projects} />
      </PageHeader>

      {google === "conectado" && (
        <p className="card !border-done-soft p-3 mb-4 text-sm text-done flex items-center gap-2">
          <CheckCircle2 size={16} aria-hidden /> Google Calendar conectado. Se creó el calendario «Mafer OS»: tus
          recordatorios sonarán en tu teléfono.
        </p>
      )}
      {google === "error" && (
        <p className="card !border-blocked-soft p-3 mb-4 text-sm text-blocked">
          No se pudo conectar con Google. Intenta de nuevo desde Ajustes, o revisa la guía «Calendario y recordatorios».
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1.5 mb-5">
        {[
          { k: "mes", label: "Mes" },
          { k: "semana", label: "Semana" },
          { k: "agenda", label: "Agenda" },
        ].map((v) => (
          <Link key={v.k} href={qs(v.k)} className={`chip ${vista === v.k ? "!bg-forest !text-cream !border-forest" : "hover:bg-sand"}`}>
            {v.label}
          </Link>
        ))}
        <span className="mx-1 text-sand-deep" aria-hidden>·</span>
        <details className="relative">
          <summary className="chip cursor-pointer list-none hover:bg-sand">
            {proyecto ? `Proyecto: ${projectName.get(proyecto) ?? ""}` : "Todos los proyectos"}
          </summary>
          <div className="absolute z-20 mt-1 card p-2 flex flex-col gap-0.5 min-w-48">
            <Link href={`/calendario?vista=${vista}`} className="text-sm px-2 py-1 rounded hover:bg-beige">Todos</Link>
            {projects.map((p) => (
              <Link key={p.id} href={`/calendario?vista=${vista}&proyecto=${p.id}`} className="text-sm px-2 py-1 rounded hover:bg-beige">
                {p.title}
              </Link>
            ))}
          </div>
        </details>
        {[
          { k: "", label: "Todo" },
          { k: "reunion", label: "Reuniones" },
          { k: "deadline", label: "Deadlines" },
          { k: "recordatorio", label: "Recordatorios" },
          { k: "tareas", label: "Tareas" },
        ].map((t) => (
          <Link
            key={t.k}
            href={`/calendario?vista=${vista}${proyecto ? `&proyecto=${proyecto}` : ""}${t.k ? `&tipo=${t.k}` : ""}`}
            className={`chip ${tipo === t.k ? "!bg-olive !text-cream !border-olive" : "hover:bg-sand"}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {vista === "mes" && (
        <section className="card p-4 md:p-5 overflow-x-auto">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl text-forest-deep">{MESES[month]} {year}</h2>
            <div className="flex gap-1">
              <Link href={qs("mes", prevMonth)} className="btn btn-ghost !p-2" aria-label="Mes anterior">
                <ChevronLeft size={18} aria-hidden />
              </Link>
              <Link href={qs("mes", nextMonth)} className="btn btn-ghost !p-2" aria-label="Mes siguiente">
                <ChevronRight size={18} aria-hidden />
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 min-w-[560px]">
            {DIAS_CORTOS.map((d) => (
              <div key={d} className="text-center text-xs font-semibold text-stone py-1">{d}</div>
            ))}
            {cells.map((date, i) => (
              <div
                key={i}
                className={`min-h-20 rounded-lg border p-1 ${
                  date === hoy ? "border-forest bg-sage-soft/60" : "border-beige bg-paper"
                } ${date ? "" : "opacity-0"}`}
              >
                {date && (
                  <>
                    <p className={`text-xs mb-0.5 ${date === hoy ? "font-bold text-forest" : "text-stone"}`}>
                      {Number(date.slice(8))}
                    </p>
                    <ul className="flex flex-col gap-0.5">
                      {(byDate.get(date) ?? []).slice(0, 3).map((o) => (
                        <li
                          key={o.id}
                          className={`truncate rounded px-1 py-0.5 text-[10px] leading-tight ${
                            o.kind === "evento" ? "bg-sage-soft text-forest-deep" : "bg-beige text-ink-green"
                          }`}
                          title={o.title}
                        >
                          {o.time && <span className="font-semibold">{o.time} </span>}
                          {o.title}
                        </li>
                      ))}
                      {(byDate.get(date)?.length ?? 0) > 3 && (
                        <li className="text-[10px] text-stone-soft px-1">+{byDate.get(date)!.length - 3} más</li>
                      )}
                    </ul>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {(vista === "semana" || vista === "agenda") && (
        <section className="flex flex-col gap-3">
          {upcoming.filter((u) => vista === "semana" || u.items.length > 0).map((u) => (
            <div key={u.date} className={`card p-4 ${u.date === hoy ? "!border-sage-deep" : ""}`}>
              <p className="text-sm font-semibold text-ink-green capitalize mb-1">
                {new Date(`${u.date}T12:00:00`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
                {u.date === hoy && <span className="chip chip-sage ml-2">Hoy</span>}
              </p>
              {u.items.length === 0 ? (
                <p className="text-xs text-stone-soft">Sin nada agendado.</p>
              ) : (
                <ul className="divide-y divide-beige">
                  {u.items.map((o) => (
                    <li key={o.id} className="py-1.5 flex items-center gap-2.5 text-sm">
                      <span className="chip shrink-0">{o.time ?? "Día"}</span>
                      {o.href ? (
                        <Link href={o.href} className="hover:underline underline-offset-4">{o.title}</Link>
                      ) : (
                        <span>{o.title}</span>
                      )}
                      <span className="ml-auto text-xs text-stone-soft capitalize">{o.kind === "tarea" ? "tarea" : o.type}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          {vista === "agenda" && occ.length === 0 && (
            <p className="text-sm text-stone">No hay nada agendado en los próximos 30 días.</p>
          )}
        </section>
      )}

      {/* Estado de Google Calendar */}
      <section className="card p-5 mt-6">
        <h2 className="text-lg text-forest-deep mb-1">Recordatorios en tu teléfono</h2>
        {!gstatus.configured ? (
          <p className="text-sm text-stone">
            Para que Mafer OS pueda mandar recordatorios a tu iPhone vía Google Calendar hace falta un paso único de
            configuración (crear credenciales en Google Cloud). La guía paso a paso está en{" "}
            <Link href="/ajustes" className="text-forest underline underline-offset-4">Ajustes</Link> y en el manual
            «Calendario y recordatorios».
          </p>
        ) : !gstatus.connected ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-stone">Credenciales listas. Falta conectar tu cuenta de Google.</p>
            <a href="/api/google/connect" className="btn btn-primary">Conectar Google Calendar</a>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-done flex items-center gap-1.5">
              <CheckCircle2 size={15} aria-hidden /> Conectado. Los eventos y tarjetas con recordatorio se copian al
              calendario «Mafer OS» de tu cuenta de Google.
            </p>
            <form action={disconnectGoogleAction}>
              <button type="submit" className="btn btn-ghost text-xs">
                <Unplug size={13} aria-hidden /> Desconectar
              </button>
            </form>
          </div>
        )}
      </section>
    </div>
  );
}
