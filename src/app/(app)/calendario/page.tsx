import Link from "next/link";
import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Unplug,
  Users,
  Flag,
  Bell,
  CircleCheckBig,
  type LucideIcon,
} from "lucide-react";
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
  endTime?: string | null;
  title: string;
  kind: "evento" | "tarea";
  type: string; // reunion|deadline|recordatorio|evento|tarea
  projectId: string | null;
  href?: string;
};

const TYPE_META: Record<string, { icon: LucideIcon; label: string; chip: string }> = {
  reunion: { icon: Users, label: "Reunión", chip: "chip-sage" },
  deadline: { icon: Flag, label: "Deadline", chip: "chip-blocked" },
  recordatorio: { icon: Bell, label: "Recordatorio", chip: "chip-waiting" },
  evento: { icon: CalendarDays, label: "Evento", chip: "chip-sage" },
  tarea: { icon: CircleCheckBig, label: "Tarea", chip: "" },
};

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseIso(s: string) {
  return new Date(`${s}T12:00:00`);
}
function addDays(s: string, n: number) {
  const d = parseIso(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}
function fechaLegible(s: string, opts: Intl.DateTimeFormatOptions) {
  return parseIso(s).toLocaleDateString("es-MX", opts);
}

function OccLine({ o }: { o: Occurrence }) {
  const meta = TYPE_META[o.type] ?? TYPE_META.evento;
  const Icon = meta.icon;
  return (
    <div className="flex items-center gap-2 text-sm py-1 min-w-0">
      <span className={`chip shrink-0 ${meta.chip}`} title={meta.label}>
        <Icon size={11} aria-hidden /> {o.time ?? "Día"}
      </span>
      {o.href ? (
        <Link href={o.href} className="truncate hover:underline underline-offset-4">{o.title}</Link>
      ) : (
        <span className="truncate">{o.title}</span>
      )}
    </div>
  );
}

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; fecha?: string; mes?: string; proyecto?: string; tipo?: string; google?: string; nuevo?: string }>;
}) {
  const params = await searchParams;
  const { vista = "mes", proyecto = "", tipo = "", google, nuevo } = params;
  const hoy = today();
  const fecha = params.fecha ?? (params.mes ? `${params.mes}-01` : hoy);
  const anchor = parseIso(fecha);
  const year = anchor.getFullYear();
  const month = anchor.getMonth();

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
      endTime: e.endTime,
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
      href: c.projectId ? `/proyectos/${c.projectId}` : "/tareas?fecha=vencidas&v=todas",
    })),
  ];
  if (proyecto) occ = occ.filter((o) => o.projectId === proyecto);
  if (tipo) occ = occ.filter((o) => (tipo === "tareas" ? o.kind === "tarea" : o.kind === "evento" && o.type === tipo));

  const byDate = new Map<string, Occurrence[]>();
  for (const o of occ) byDate.set(o.date, [...(byDate.get(o.date) ?? []), o]);
  for (const list of byDate.values()) list.sort((a, b) => ((a.time ?? "99") < (b.time ?? "99") ? -1 : 1));

  const keep = (extra: Record<string, string>) => {
    const merged: Record<string, string> = { vista, fecha, proyecto, tipo, ...extra };
    const parts = Object.entries(merged)
      .filter(([k, v]) => v && !(k === "vista" && v === "mes") && !(k === "fecha" && v === hoy))
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`);
    return `/calendario${parts.length ? "?" + parts.join("&") : ""}`;
  };

  // navegación anterior/siguiente según vista
  const step = vista === "dia" ? 1 : vista === "semana" ? 7 : 0;
  const prevHref =
    vista === "mes" ? keep({ fecha: iso(new Date(year, month - 1, 1)) }) : keep({ fecha: addDays(fecha, -step) });
  const nextHref =
    vista === "mes" ? keep({ fecha: iso(new Date(year, month + 1, 1)) }) : keep({ fecha: addDays(fecha, step) });

  // celdas del mes (lunes primero)
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array<null>(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => iso(new Date(year, month, i + 1))),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  // semana que contiene `fecha` (lunes a domingo)
  const weekStart = addDays(fecha, -((parseIso(fecha).getDay() + 6) % 7));
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 7:00–22:00
  const nowHour = new Date().getHours();

  const titulo =
    vista === "dia"
      ? fechaLegible(fecha, { weekday: "long", day: "numeric", month: "long" })
      : vista === "semana"
        ? `Semana del ${fechaLegible(weekStart, { day: "numeric", month: "long" })}`
        : `${MESES[month]} ${year}`;

  return (
    <div>
      <PageHeader
        icon={CalendarDays}
        title="Calendario"
        intro="Reuniones, fechas límite, tareas con fecha y recordatorios."
      >
        <NewEventButton projects={projects} autoOpen={nuevo === "1"} />
      </PageHeader>

      {google === "conectado" && (
        <p className="card !border-done-soft p-3 mb-4 text-sm text-done flex items-center gap-2">
          <CheckCircle2 size={16} aria-hidden /> Google Calendar conectado. Se creó el calendario «Mafer OS».
        </p>
      )}
      {google === "error" && (
        <p className="card !border-blocked-soft p-3 mb-4 text-sm text-blocked">
          No se pudo conectar con Google. Revisa la guía «Calendario y recordatorios» en Ajustes.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        {[
          { k: "dia", label: "Día" },
          { k: "semana", label: "Semana" },
          { k: "mes", label: "Mes" },
          { k: "agenda", label: "Agenda" },
        ].map((v) => (
          <Link key={v.k} href={keep({ vista: v.k })} data-testid={`vista-${v.k}`} className={`chip ${vista === v.k ? "!bg-forest !text-cream !border-forest" : "hover:bg-sand"}`}>
            {v.label}
          </Link>
        ))}
        <span className="mx-1 text-sand-deep" aria-hidden>·</span>
        {[
          { k: "", label: "Todo" },
          { k: "reunion", label: "Reuniones" },
          { k: "deadline", label: "Deadlines" },
          { k: "recordatorio", label: "Recordatorios" },
          { k: "tareas", label: "Tareas" },
        ].map((t) => (
          <Link key={t.k} href={keep({ tipo: t.k })} className={`chip ${tipo === t.k ? "!bg-olive !text-cream !border-olive" : "hover:bg-sand"}`}>
            {t.label}
          </Link>
        ))}
        <details className="relative ml-1">
          <summary className="chip cursor-pointer list-none hover:bg-sand">
            {proyecto ? `Proyecto: ${projectName.get(proyecto) ?? ""}` : "Todos los proyectos"}
          </summary>
          <div className="absolute z-20 mt-1 card p-2 flex flex-col gap-0.5 min-w-48">
            <Link href={keep({ proyecto: "" })} className="text-sm px-2 py-1 rounded hover:bg-beige">Todos</Link>
            {projects.map((p) => (
              <Link key={p.id} href={keep({ proyecto: p.id })} className="text-sm px-2 py-1 rounded hover:bg-beige">
                {p.title}
              </Link>
            ))}
          </div>
        </details>
      </div>

      <section className="card p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl md:text-2xl text-forest-deep capitalize">{titulo}</h2>
          <div className="flex items-center gap-1">
            <Link href={keep({ fecha: hoy })} className="btn btn-secondary !py-1.5 !px-3 text-xs">Hoy</Link>
            {vista !== "agenda" && (
              <>
                <Link href={prevHref} className="btn btn-ghost !p-2" aria-label="Anterior">
                  <ChevronLeft size={18} aria-hidden />
                </Link>
                <Link href={nextHref} className="btn btn-ghost !p-2" aria-label="Siguiente">
                  <ChevronRight size={18} aria-hidden />
                </Link>
              </>
            )}
          </div>
        </div>

        {vista === "mes" && (
          <div className="overflow-x-auto">
            <div className="grid grid-cols-7 gap-1.5 min-w-[640px]">
              {DIAS_CORTOS.map((d) => (
                <div key={d} className="text-center text-xs font-semibold text-stone py-1">{d}</div>
              ))}
              {cells.map((date, i) => (
                <div
                  key={i}
                  className={`min-h-28 rounded-xl border p-1.5 ${
                    date === hoy ? "border-forest bg-sage-soft/60" : "border-beige bg-paper"
                  } ${date ? "" : "opacity-0"}`}
                >
                  {date && (
                    <>
                      <Link
                        href={keep({ vista: "dia", fecha: date })}
                        className={`text-xs mb-1 inline-block rounded px-1 hover:bg-sand ${date === hoy ? "font-bold text-forest" : "text-stone"}`}
                      >
                        {Number(date.slice(8))}
                      </Link>
                      <ul className="flex flex-col gap-0.5">
                        {(byDate.get(date) ?? []).slice(0, 4).map((o) => {
                          const meta = TYPE_META[o.type] ?? TYPE_META.evento;
                          const Icon = meta.icon;
                          return (
                            <li
                              key={o.id}
                              className={`flex items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[11px] leading-tight ${
                                o.kind === "evento" ? "bg-sage-soft text-forest-deep" : "bg-beige text-ink-green"
                              }`}
                              title={`${meta.label}: ${o.title}`}
                            >
                              <Icon size={10} className="shrink-0" aria-hidden />
                              {o.time && <span className="font-semibold shrink-0">{o.time}</span>}
                              <span className="truncate">{o.title}</span>
                            </li>
                          );
                        })}
                        {(byDate.get(date)?.length ?? 0) > 4 && (
                          <li className="text-[10px] text-stone-soft px-1">+{byDate.get(date)!.length - 4} más</li>
                        )}
                      </ul>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {vista === "dia" && (
          <DayView items={byDate.get(fecha) ?? []} hours={HOURS} nowHour={fecha === hoy ? nowHour : null} />
        )}

        {vista === "semana" && (
          <div className="overflow-x-auto">
            <div className="grid grid-cols-7 gap-1.5 min-w-[760px]">
              {weekDays.map((d) => (
                <div key={d} className={`rounded-xl border p-2 min-h-48 ${d === hoy ? "border-forest bg-sage-soft/50" : "border-beige bg-paper"}`}>
                  <Link
                    href={keep({ vista: "dia", fecha: d })}
                    className={`block text-center text-xs mb-2 rounded hover:bg-sand ${d === hoy ? "font-bold text-forest" : "text-stone"}`}
                  >
                    {fechaLegible(d, { weekday: "short", day: "numeric" })}
                  </Link>
                  <div className="flex flex-col gap-1">
                    {(byDate.get(d) ?? []).map((o) => {
                      const meta = TYPE_META[o.type] ?? TYPE_META.evento;
                      const Icon = meta.icon;
                      return (
                        <div
                          key={o.id}
                          className={`rounded-md px-1.5 py-1 text-[11px] leading-tight ${
                            o.kind === "evento" ? "bg-sage-soft text-forest-deep" : "bg-beige text-ink-green"
                          }`}
                          title={`${meta.label}: ${o.title}`}
                        >
                          <span className="flex items-center gap-1 font-semibold">
                            <Icon size={10} aria-hidden /> {o.time ?? "Día"}
                          </span>
                          <span className="block truncate">{o.title}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {vista === "agenda" && (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 30 }, (_, i) => addDays(hoy, i))
              .filter((d) => (byDate.get(d) ?? []).length > 0)
              .map((d) => (
                <div key={d} className={`rounded-xl border p-3 ${d === hoy ? "border-forest" : "border-beige"}`}>
                  <p className="text-sm font-semibold text-ink-green capitalize mb-1">
                    {fechaLegible(d, { weekday: "long", day: "numeric", month: "long" })}
                    {d === hoy && <span className="chip chip-sage ml-2">Hoy</span>}
                  </p>
                  <div className="divide-y divide-beige">
                    {(byDate.get(d) ?? []).map((o) => (
                      <OccLine key={o.id} o={o} />
                    ))}
                  </div>
                </div>
              ))}
            {occ.filter((o) => o.date >= hoy && o.date <= addDays(hoy, 29)).length === 0 && (
              <p className="text-sm text-stone">No hay nada agendado en los próximos 30 días.</p>
            )}
          </div>
        )}
      </section>

      {/* Estado de Google Calendar */}
      <section className="card p-5 mt-6">
        <h2 className="text-lg text-forest-deep mb-1">Recordatorios en tu teléfono</h2>
        {!gstatus.configured ? (
          <p className="text-sm text-stone">
            Falta un paso único de configuración de Google (guía en{" "}
            <Link href="/ajustes" className="text-forest underline underline-offset-4">Ajustes</Link> y en el manual
            «Calendario y recordatorios»). La integración ya está construida; no está conectada todavía.
          </p>
        ) : !gstatus.connected ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-stone">Credenciales listas. Falta conectar tu cuenta de Google.</p>
            <a href="/api/google/connect" className="btn btn-primary">Conectar Google Calendar</a>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-done flex items-center gap-1.5">
              <CheckCircle2 size={15} aria-hidden /> Conectado. Eventos y tarjetas con recordatorio se copian al
              calendario «Mafer OS».
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

function DayView({
  items,
  hours,
  nowHour,
}: {
  items: Occurrence[];
  hours: number[];
  nowHour: number | null;
}) {
  const allDay = items.filter((o) => !o.time);
  const timed = items.filter((o) => o.time);
  const byHour = new Map<number, Occurrence[]>();
  for (const o of timed) {
    const h = Number(o.time!.split(":")[0]);
    byHour.set(h, [...(byHour.get(h) ?? []), o]);
  }

  return (
    <div data-testid="day-view">
      {allDay.length > 0 && (
        <div className="mb-3 rounded-xl bg-beige/70 border border-sand p-3">
          <p className="label !mb-1.5">Todo el día</p>
          <div className="flex flex-col">
            {allDay.map((o) => (
              <OccLine key={o.id} o={o} />
            ))}
          </div>
        </div>
      )}
      <div className="rounded-xl border border-beige overflow-hidden">
        {hours.map((h) => {
          const isNow = nowHour === h;
          const list = byHour.get(h) ?? [];
          return (
            <div
              key={h}
              className={`flex gap-3 border-b border-beige last:border-b-0 px-3 ${
                isNow ? "bg-sage-soft/50" : ""
              } ${list.length ? "py-2" : "py-1.5"}`}
            >
              <span className={`w-12 shrink-0 text-xs tabular-nums pt-1 ${isNow ? "font-bold text-forest" : "text-stone-soft"}`}>
                {String(h).padStart(2, "0")}:00
                {isNow && <span className="block h-0.5 mt-1 rounded bg-forest" aria-hidden />}
              </span>
              <div className="min-w-0 flex-1 flex flex-col">
                {list.map((o) => (
                  <OccLine key={o.id} o={o} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {items.length === 0 && (
        <p className="text-sm text-stone mt-3">Nada agendado para este día.</p>
      )}
    </div>
  );
}
