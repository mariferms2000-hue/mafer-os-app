import Link from "next/link";
import {
  Sun,
  CalendarDays,
  Timer,
  Ban,
  Hourglass,
  ArrowRight,
  Moon,
  Inbox,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { getTodayData } from "@/lib/queries/today";
import { Priorities, EnergySelector } from "@/components/hoy/priorities";
import { TaskLine } from "@/components/hoy/task-line";
import { EmptyState } from "@/components/ui/empty-state";
import { Sprig } from "@/components/ui/botanical";

export const dynamic = "force-dynamic";
export const metadata = { title: "Hoy" };

const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const DIAS = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];

function fechaLarga(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const dia = DIAS[date.getDay()];
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${d} de ${MESES[m - 1]}`;
}

function saludo() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

export default async function HoyPage() {
  const data = await getTodayData();
  // La energía del día cambia las sugerencias automáticas (nunca tus 3 prioridades manuales):
  // baja → solo tareas cortas y ligeras · media → todo lo corto · alta → además trabajo profundo.
  const quickFiltered =
    data.energy === "baja"
      ? data.quick.filter((c) => !c.energy || c.energy === "baja")
      : data.energy === "alta"
        ? data.quick.filter((c) => c.energy !== "baja").concat(data.quick.filter((c) => c.energy === "baja"))
        : data.quick;
  const showDeepWork = data.energy === "alta" && data.deepWork.length > 0;

  const resumen: string[] = [];
  if (data.priorities.length) resumen.push(`${data.priorities.length} prioridad${data.priorities.length > 1 ? "es" : ""}`);
  if (data.eventsToday.length) resumen.push(`${data.eventsToday.length} evento${data.eventsToday.length > 1 ? "s" : ""}`);
  if (data.dueToday.length) resumen.push(`${data.dueToday.length} con fecha de hoy`);
  if (data.inboxCount) resumen.push(`${data.inboxCount} en el Inbox`);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3 mb-1">
        <div>
          <p className="section-eyebrow">{fechaLarga(data.date)}</p>
          <h1 className="text-[34px] md:text-[40px] leading-tight text-forest-deep mt-1 flex items-center gap-3">
            {saludo()}, {data.userName}
            <Sprig className="h-9 w-9 text-sage-deep/70 shrink-0 hidden sm:block" />
          </h1>
          <p className="intro-italic text-[15px] mt-1">
            {resumen.length ? `Hoy tienes ${resumen.join(", ")}.` : "Día tranquilo por ahora. Tú decides el rumbo."}
          </p>
        </div>
        <EnergySelector current={data.energy} />
      </header>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 flex flex-col gap-5">
          <Priorities priorities={data.priorities} candidates={data.candidates} />

          {/* Reuniones y fechas de hoy */}
          <section aria-labelledby="agenda-hoy" className="card p-5">
            <div className="flex items-center justify-between mb-2">
              <h2 id="agenda-hoy" className="text-lg text-forest-deep flex items-center gap-2">
                <CalendarDays size={18} className="text-olive" aria-hidden /> Agenda de hoy
              </h2>
              <Link href="/calendario?vista=dia" className="text-xs text-stone hover:text-forest underline-offset-4 hover:underline">Ver todo</Link>
            </div>
            {data.eventsToday.length === 0 && data.dueToday.length === 0 ? (
              <p className="text-sm text-stone">Sin reuniones ni fechas límite hoy. Espacio para trabajo con calma.</p>
            ) : (
              <ul className="divide-y divide-beige">
                {data.eventsToday.map((e) => (
                  <li key={e.id} className="py-2 flex items-center gap-3 text-sm">
                    <span className="chip chip-sage shrink-0">{e.startTime ?? "Todo el día"}</span>
                    <span className="font-medium">{e.title}</span>
                    <span className="text-xs text-stone ml-auto capitalize">{e.type}</span>
                  </li>
                ))}
                {data.dueToday.map((c) => (
                  <li key={c.id}>
                    <TaskLine card={c} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Con energía alta, el trabajo profundo va primero */}
          {showDeepWork && (
            <section aria-labelledby="profundo" className="card p-5 !border-sage-deep">
              <h2 id="profundo" className="text-lg text-forest-deep flex items-center gap-2 mb-1">
                <Sun size={18} className="text-olive" aria-hidden /> Aprovecha tu energía alta
              </h2>
              <p className="text-xs text-stone mb-2">
                Trabajo profundo, decisiones y tareas importantes — el mejor uso de un día con pila.
              </p>
              <ul className="divide-y divide-beige" data-testid="deep-work-list">
                {data.deepWork.slice(0, 5).map((c) => (
                  <li key={c.id}>
                    <TaskLine card={c} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Menos de 30 minutos */}
          <section aria-labelledby="rapidas" className="card p-5">
            <div className="flex items-center justify-between mb-1">
              <h2 id="rapidas" className="text-lg text-forest-deep flex items-center gap-2">
                <Timer size={18} className="text-olive" aria-hidden /> Menos de 30 minutos
              </h2>
              <Link href="/tareas?f=rapidas" className="text-xs text-stone hover:text-forest underline-offset-4 hover:underline">Ver todo</Link>
            </div>
            <p className="text-xs text-stone mb-2">
              {data.energy === "baja"
                ? "Ajustado a tu energía baja: solo cosas ligeras que sí puedes terminar hoy."
                : data.energy === "alta"
                  ? "Para los huecos entre bloques de trabajo profundo."
                  : "Cosas que puedes terminar en un hueco corto."}
            </p>
            {quickFiltered.length === 0 ? (
              <p className="text-sm text-stone">
                Nada corto pendiente. Cuando crees tarjetas, asígnales duración (5, 15 o 30 min) y aparecerán aquí.
              </p>
            ) : (
              <ul className="divide-y divide-beige">
                {quickFiltered.slice(0, 6).map((c) => (
                  <li key={c.id}>
                    <TaskLine card={c} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Próximos pasos concretos */}
          <section aria-labelledby="siguientes" className="card p-5">
            <div className="flex items-center justify-between mb-2">
              <h2 id="siguientes" className="text-lg text-forest-deep flex items-center gap-2">
                <ArrowRight size={18} className="text-olive" aria-hidden /> Siguiente paso por proyecto
              </h2>
              <Link href="/proyectos" className="text-xs text-stone hover:text-forest underline-offset-4 hover:underline">Ver todo</Link>
            </div>
            {data.nextSteps.length === 0 ? (
              <p className="text-sm text-stone">
                Cuando definas la «próxima acción» de cada proyecto activo, aparecerá aquí para que nunca tengas que
                recordar dónde ibas.
              </p>
            ) : (
              <ul className="divide-y divide-beige">
                {data.nextSteps.map((s) => (
                  <li key={s.projectId} className="py-2.5 flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{s.nextAction}</p>
                      <p className="text-xs text-stone">{s.projectTitle}</p>
                    </div>
                    <Link
                      href={`/proyectos/${s.projectId}?retomar=1`}
                      className="btn btn-ghost !py-1 !px-2 text-xs shrink-0"
                      aria-label={`Retomar ${s.projectTitle}`}
                    >
                      <RotateCcw size={13} aria-hidden /> Retomar
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-5">
          {/* Vencidas y próximas */}
          {(data.overdue.length > 0 || data.approaching.length > 0) && (
            <section aria-labelledby="fechas" className="card p-5">
              <h2 id="fechas" className="text-lg text-forest-deep flex items-center gap-2 mb-2">
                <Sun size={18} className="text-olive" aria-hidden /> Fechas que respiran cerca
              </h2>
              {data.overdue.length > 0 && (
                <>
                  <p className="text-xs text-stone mb-1">
                    Se pasaron de fecha — sin drama, solo decide: hacer, reagendar o soltar.
                  </p>
                  <ul className="divide-y divide-beige mb-3">
                    {data.overdue.slice(0, 5).map((c) => (
                      <li key={c.id}>
                        <TaskLine card={c} />
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {data.approaching.length > 0 && (
                <>
                  <p className="text-xs text-stone mb-1">Próximos 7 días:</p>
                  <ul className="divide-y divide-beige">
                    {data.approaching.slice(0, 5).map((c) => (
                      <li key={c.id}>
                        <TaskLine card={c} />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}

          {/* Bloqueado */}
          <section aria-labelledby="bloqueado" className="card p-5">
            <div className="flex items-center justify-between mb-2">
              <h2 id="bloqueado" className="text-lg text-forest-deep flex items-center gap-2">
                <Ban size={18} className="text-blocked" aria-hidden /> Bloqueado
              </h2>
              <Link href="/tareas?f=bloqueadas" className="text-xs text-stone hover:text-forest underline-offset-4 hover:underline">Ver todo</Link>
            </div>
            {data.blocked.length === 0 ? (
              <p className="text-sm text-stone">Nada bloqueado. 🌿</p>
            ) : (
              <ul className="divide-y divide-beige">
                {data.blocked.slice(0, 5).map((c) => (
                  <li key={c.id}>
                    <TaskLine card={c} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Esperando */}
          <section aria-labelledby="esperando" className="card p-5">
            <div className="flex items-center justify-between mb-2">
              <h2 id="esperando" className="text-lg text-forest-deep flex items-center gap-2">
                <Hourglass size={18} className="text-waiting" aria-hidden /> Esperando
              </h2>
              <Link href="/tareas?f=esperando" className="text-xs text-stone hover:text-forest underline-offset-4 hover:underline">Ver todo</Link>
            </div>
            {data.waiting.length === 0 ? (
              <p className="text-sm text-stone">No esperas nada de nadie por ahora.</p>
            ) : (
              <ul className="divide-y divide-beige">
                {data.waiting.slice(0, 5).map((c) => (
                  <li key={c.id}>
                    <TaskLine card={c} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Para después */}
          <section aria-labelledby="despues" className="card p-5">
            <h2 id="despues" className="text-lg text-forest-deep flex items-center gap-2 mb-2">
              <Moon size={18} className="text-stone" aria-hidden /> Para después
            </h2>
            {data.deferred.length === 0 ? (
              <p className="text-sm text-stone">Nada pospuesto conscientemente.</p>
            ) : (
              <ul className="divide-y divide-beige">
                {data.deferred.slice(0, 5).map((c) => (
                  <li key={c.id}>
                    <TaskLine card={c} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {data.inboxCount > 0 && (
            <Link href="/inbox" className="card p-4 flex items-center gap-3 hover:shadow-lift transition-shadow">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sage-soft text-forest">
                <Inbox size={19} aria-hidden />
              </span>
              <div>
                <p className="text-sm font-medium">
                  {data.inboxCount} captura{data.inboxCount > 1 ? "s" : ""} sin procesar
                </p>
                <p className="text-xs text-stone">Dales un destino cuando tengas 5 minutos.</p>
              </div>
              <ArrowRight size={16} className="ml-auto text-stone" aria-hidden />
            </Link>
          )}
        </div>
      </div>

      {data.candidates.length === 0 && data.priorities.length === 0 && (
        <EmptyState
          icon={Sparkles}
          title="Tu sistema está listo y esperándote"
          hint="Empieza capturando lo que tengas en la cabeza con el botón + (abajo a la derecha), o crea tu primer proyecto."
        >
          <Link href="/proyectos" className="btn btn-primary">Ir a Proyectos</Link>
        </EmptyState>
      )}
    </div>
  );
}
