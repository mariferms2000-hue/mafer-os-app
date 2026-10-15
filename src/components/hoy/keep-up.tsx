"use client";

import Link from "next/link";
import { BellRing, CalendarX2, Ban, Hourglass, CalendarClock, FolderClock, ArrowRight, type LucideIcon } from "lucide-react";
import { openTaskUrl } from "@/components/tasks/task-detail";
import type { KeepUp as KeepUpData } from "@/lib/keep-up";
import type { CardRow } from "@/lib/queries/today";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MAX = 4;

function diasHasta(ymd: string, hoy: string): number {
  return Math.round((Date.parse(ymd) - Date.parse(hoy)) / 86_400_000);
}

/** «mañana», «jue 16 oct». */
function fechaCorta(ymd: string, hoy: string): string {
  if (diasHasta(ymd, hoy) === 1) return "mañana";
  const d = new Date(`${ymd}T12:00:00Z`);
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`;
}

/** «venció ayer», «venció hace 5 días». */
function vencio(ymd: string, hoy: string): string {
  const n = -diasHasta(ymd, hoy);
  return n === 1 ? "venció ayer" : `venció hace ${n} días`;
}

function Row({ card, detail, tone }: { card: CardRow; detail: string; tone?: "blocked" | "waiting" | "due" }) {
  const color = tone === "blocked" ? "text-blocked" : tone === "waiting" ? "text-waiting" : tone === "due" ? "text-blocked" : "text-stone";
  return (
    <li className="border-b border-beige last:border-0">
      <button
        type="button"
        onClick={() => openTaskUrl(card.id)}
        className="w-full text-left py-2 group"
        data-testid="keepup-task"
        aria-label={`Abrir «${card.title}»`}
      >
        <span className="block text-sm leading-snug text-charcoal group-hover:text-forest transition-colors line-clamp-2">
          {card.title}
        </span>
        <span className="block text-xs mt-0.5 min-w-0 line-clamp-2">
          <span className={color}>{detail}</span>
          {card.projectTitle && <span className="text-stone-soft"> · {card.projectTitle}</span>}
        </span>
      </button>
    </li>
  );
}

function Group({
  title,
  icon: Icon,
  iconClass,
  count,
  href,
  testid,
  children,
}: {
  title: string;
  icon: LucideIcon;
  iconClass: string;
  count: number;
  href: string;
  testid: string;
  children: React.ReactNode;
}) {
  return (
    <div data-testid={testid} className="mt-4 first:mt-0">
      <h3 className="font-body text-xs font-semibold text-stone flex items-center gap-1.5">
        <Icon size={13} className={iconClass} aria-hidden /> {title}
        <span className="text-stone-soft font-normal">({count})</span>
      </h3>
      <ul className="flex flex-col">{children}</ul>
      {count > MAX && (
        <Link href={href} className="text-xs text-stone hover:text-forest underline-offset-4 hover:underline inline-flex items-center gap-1 mt-1">
          Ver las {count} <ArrowRight size={11} aria-hidden />
        </Link>
      )}
    </div>
  );
}

/** «Para que nada se caiga»: vencidas, bloqueadas, esperando y la semana que viene, cada
 *  tarea una sola vez; abajo, los proyectos que se están quedando quietos.
 *  Un toque abre la tarea. Sin estimaciones ni regaños. */
export function KeepUp({ data, today }: { data: KeepUpData; today: string }) {
  const { overdue, blocked, waiting, upcoming, projects } = data;
  const empty = !overdue.length && !blocked.length && !waiting.length && !upcoming.length && !projects.length;

  return (
    <section aria-labelledby="keepup" className="card p-5" data-testid="keep-up">
      <h2 id="keepup" className="section-eyebrow flex items-center gap-1.5 mb-3">
        <BellRing size={13} className="text-sage-deep" aria-hidden /> Para que nada se caiga
      </h2>
      {empty ? (
        <p className="text-sm text-stone" data-testid="keepup-empty">Nada se está cayendo. 🌿</p>
      ) : (
        <div className="flex flex-col">
          {overdue.length > 0 && (
            <Group title="Vencidas" icon={CalendarX2} iconClass="text-blocked" count={overdue.length} href="/tareas?v=proximas" testid="keepup-overdue">
              {overdue.slice(0, MAX).map((c) => (
                <Row key={c.id} card={c} detail={vencio(c.dueDate!, today)} tone="due" />
              ))}
            </Group>
          )}
          {blocked.length > 0 && (
            <Group title="Bloqueadas" icon={Ban} iconClass="text-blocked" count={blocked.length} href="/tareas?v=bloqueadas" testid="keepup-blocked">
              {blocked.slice(0, MAX).map((c) => (
                <Row key={c.id} card={c} detail={c.blockedReason || "En la lista Bloqueado"} tone="blocked" />
              ))}
            </Group>
          )}
          {waiting.length > 0 && (
            <Group title="Esperando" icon={Hourglass} iconClass="text-waiting" count={waiting.length} href="/tareas?v=esperando" testid="keepup-waiting">
              {waiting.slice(0, MAX).map((c) => (
                <Row
                  key={c.id}
                  card={c}
                  detail={`${c.waitingFor ? `a ${c.waitingFor}` : "esperando"}${c.waitingDays >= 7 ? ` · ${c.waitingDays} días` : ""}`}
                  tone="waiting"
                />
              ))}
            </Group>
          )}
          {upcoming.length > 0 && (
            <Group title="La semana que viene" icon={CalendarClock} iconClass="text-sage-deep" count={upcoming.length} href="/tareas?v=proximas" testid="keepup-upcoming">
              {upcoming.slice(0, MAX).map((c) => (
                <Row key={c.id} card={c} detail={fechaCorta(c.dueDate!, today)} />
              ))}
            </Group>
          )}
          {projects.length > 0 && (
            <Group title="Proyectos quietos" icon={FolderClock} iconClass="text-olive" count={projects.length} href="/proyectos?f=atencion" testid="keepup-projects">
              {projects.slice(0, MAX).map((p) => (
                <li key={p.id} className="border-b border-beige last:border-0">
                  <Link href={`/proyectos/${p.id}?retomar=1`} className="block py-2 group" data-testid="keepup-project">
                    <span className="block text-sm text-charcoal group-hover:text-forest transition-colors">{p.title}</span>
                    <span className="block text-xs text-stone mt-0.5">
                      {[p.noNextAction && "sin siguiente acción", p.idleDays !== null && `${p.idleDays} días sin movimiento`]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </Link>
                </li>
              ))}
            </Group>
          )}
        </div>
      )}
    </section>
  );
}
