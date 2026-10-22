import Link from "next/link";
import { CircleCheckBig, Inbox, Sparkles, ArrowRight, AlertTriangle } from "lucide-react";
import { getTodayData } from "@/lib/queries/today";
import { currentHour, dayOfWeek } from "@/lib/tz";
import { getFocusOverview } from "@/lib/queries/focus";
import { FocusModule } from "@/components/hoy/focus-module";
import { DoNow } from "@/components/hoy/do-now";
import { Highlights } from "@/components/hoy/highlights";
import { KeepUp } from "@/components/hoy/keep-up";
import { WeekAgenda } from "@/components/hoy/week-agenda";
import { EmptyState } from "@/components/ui/empty-state";
import { Sprig } from "@/components/ui/botanical";
import { parseWeekParam } from "@/lib/week-agenda";
import { today } from "@/lib/db";
import { avisoErrorCount } from "@/lib/avisos/sync";

export const dynamic = "force-dynamic";
export const metadata = { title: "Hoy" };

const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const DIAS = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];

function fechaLarga(iso: string) {
  const [, m, d] = iso.split("-").map(Number);
  const dia = DIAS[dayOfWeek(iso)];
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${d} de ${MESES[m - 1]}`;
}

function saludo() {
  const h = currentHour();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

/** Hoy (Bloque 2): un tablero personal, no una lista interminable.
 *  Arriba lo que haces ahora y tu enfoque; en medio tus compromisos; a la
 *  derecha (abajo en el iPhone) lo que no debe caerse. Las listas completas
 *  viven en Tareas y Proyectos, a un toque desde aquí.
 *
 *  Orden en el iPhone: los bloques se aplanan con `contents` y se ordenan con
 *  `order-*`; desde 1280 px vuelven a ser dos columnas, con la derecha fija
 *  para que el Jardín y «Para que nada se caiga» nunca queden apretados. */
export default async function HoyPage({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const { semana } = await searchParams;
  const data = await getTodayData(parseWeekParam(semana, today()));
  const focus = await getFocusOverview();
  const avisosConFallo = await avisoErrorCount();

  const resumen: string[] = [];
  const deHoy = data.agenda.days.find((d) => d.isToday)?.items ?? [];
  const eventos = deHoy.filter((i) => i.kind === "evento").length;
  const conFecha = deHoy.length - eventos;
  if (eventos) resumen.push(`${eventos} evento${eventos > 1 ? "s" : ""}`);
  if (conFecha) resumen.push(`${conFecha} con fecha de hoy`);
  if (data.keepUp.overdue.length) resumen.push(`${data.keepUp.overdue.length} vencida${data.keepUp.overdue.length > 1 ? "s" : ""}`);

  const sinNada = data.doNow.length === 0 && data.priorities.length === 0 && deHoy.length === 0 && data.inboxCount === 0;

  return (
    <div className="flex flex-col gap-5">
      <header className="mb-1">
        <p className="section-eyebrow">{fechaLarga(data.date)}</p>
        <h1 className="text-[32px] md:text-[40px] leading-tight text-forest-deep mt-1 flex items-center gap-3">
          {saludo()}, {data.userName}
          <Sprig className="h-9 w-9 text-sage-deep/70 shrink-0 hidden sm:block" />
        </h1>
        <p className="intro-italic text-[15px] mt-1">
          {resumen.length ? `Hoy tienes ${resumen.join(", ")}.` : "Día tranquilo por ahora. Tú decides el rumbo."}
        </p>
        {/* Accesos rápidos: la lista completa y lo capturado, a un toque */}
        <nav aria-label="Accesos rápidos" className="flex flex-wrap gap-2 mt-3">
          <Link href="/tareas" className="btn btn-secondary !py-1.5 !px-3 text-sm" data-testid="hoy-all-tasks">
            <CircleCheckBig size={15} aria-hidden /> Todas las tareas
          </Link>
          <Link href="/inbox" className="btn btn-secondary !py-1.5 !px-3 text-sm" data-testid="hoy-inbox">
            <Inbox size={15} aria-hidden /> Inbox
            {data.inboxCount > 0 && <span className="chip chip-sage !py-0 tabular-nums">{data.inboxCount}</span>}
          </Link>
        </nav>
        {avisosConFallo > 0 && (
          <Link
            href="/ajustes#avisos"
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-beige px-3 py-2 text-sm text-blocked hover:bg-sand/50"
            data-testid="hoy-avisos-fallo"
          >
            <AlertTriangle size={15} aria-hidden />
            {avisosConFallo === 1 ? "1 aviso no se pudo sincronizar con Google" : `${avisosConFallo} avisos no se pudieron sincronizar con Google`}
            <span className="underline underline-offset-4">Reparar</span>
          </Link>
        )}
      </header>

      <div className="flex flex-col gap-5 xl:grid xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="contents xl:flex xl:flex-col xl:gap-5 xl:min-w-0">
          <div className="order-1 xl:order-none min-w-0">
            <DoNow items={data.doNow} energy={data.energy} />
          </div>

          {/* Agenda: la semana de lunes a domingo, con hoy al frente */}
          <div className="order-3 xl:order-none min-w-0">
            <WeekAgenda agenda={data.agenda} />
          </div>

          <div className="order-4 xl:order-none min-w-0 empty:hidden">
            <Highlights cards={data.priorities} />
          </div>
        </div>

        <div className="contents xl:flex xl:flex-col xl:gap-5 xl:min-w-0">
          {/* Jardín de enfoque: el acceso de siempre al Pomodoro */}
          <div className="order-2 xl:order-none min-w-0">
            <FocusModule overview={focus} />
          </div>
          <div className="order-5 xl:order-none min-w-0">
            <KeepUp data={data.keepUp} today={data.date} />
          </div>
        </div>
      </div>

      {sinNada && (
        <EmptyState
          icon={Sparkles}
          variant="brote"
          title="Tu sistema está listo y esperándote"
          hint="Captura lo que tengas en la cabeza con el botón + (abajo a la derecha), o crea tu primer proyecto."
        >
          <Link href="/proyectos" className="btn btn-primary">
            Ir a Proyectos <ArrowRight size={15} aria-hidden />
          </Link>
        </EmptyState>
      )}
    </div>
  );
}
