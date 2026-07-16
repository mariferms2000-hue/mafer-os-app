"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, DoorOpen, Play, RotateCcw, Check, CalendarClock, Moon,
  Archive, Trash2, Pause, FolderInput, Rocket, SquareKanban, Lightbulb, Sun,
} from "lucide-react";
import {
  startReviewAction, goToReviewStepAction, finishReviewAction, resetReviewAction, bumpReviewProcessedAction,
} from "@/lib/actions/reviews";
import { rescheduleCardAction, moveCardToKindAction, archiveCardAction } from "@/lib/actions/cards";
import { setProjectStatusAction, archiveProjectAction } from "@/lib/actions/projects";
import { updateIdeaStatusAction, graduateIdeaAction, touchIdeaAction, deleteIdeaAction, setLearningStatusAction } from "@/lib/actions/explore";
import { updateResourceStatusAction, deleteResourceAction } from "@/lib/actions/library";
import { TaskLine } from "@/components/hoy/task-line";
import { useToast } from "@/components/ui/toast";
import type { CardRow } from "@/lib/queries/today";

/* ── Iniciar / continuar / reiniciar ─────────────────────────────── */

export function StartReviewButton({ tipo, label, className }: { tipo: "diaria" | "semanal"; label: string; className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className={className ?? "btn btn-primary"}
      disabled={pending}
      data-testid={`start-${tipo}`}
      onClick={() =>
        start(async () => {
          const s = await startReviewAction(tipo);
          router.push(`/revisiones/${tipo}?paso=${s.step}`);
        })
      }
    >
      <Play size={14} aria-hidden /> {label}
    </button>
  );
}

/** Continuar · Reiniciar (con confirmación; no revierte nada) · Dar por terminada. */
export function ContinueControls({ tipo, sessionId, step }: { tipo: "diaria" | "semanal"; sessionId: string; step: number }) {
  const router = useRouter();
  const [confirmReset, setConfirmReset] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={`/revisiones/${tipo}?paso=${step}`} className="btn btn-primary !py-1.5 text-xs" data-testid={`continue-${tipo}`}>
        <Play size={13} aria-hidden /> Continuar
      </Link>
      {confirmReset ? (
        <span className="flex items-center gap-1.5 text-xs">
          Lo ya hecho no se revierte. ¿Reiniciar?
          <button
            type="button"
            className="btn btn-danger !py-1 !px-2 text-xs"
            disabled={pending}
            data-testid={`reset-confirm-${tipo}`}
            onClick={() =>
              start(async () => {
                const r = await resetReviewAction(sessionId);
                if (r) router.push(`/revisiones/${tipo}?paso=1`);
              })
            }
          >
            Sí
          </button>
          <button type="button" className="btn btn-ghost !py-1 !px-2 text-xs" onClick={() => setConfirmReset(false)}>
            No
          </button>
        </span>
      ) : (
        <button type="button" className="btn btn-ghost !py-1.5 text-xs" onClick={() => setConfirmReset(true)} data-testid={`reset-${tipo}`}>
          <RotateCcw size={13} aria-hidden /> Reiniciar
        </button>
      )}
      <button
        type="button"
        className="btn btn-ghost !py-1.5 text-xs"
        disabled={pending}
        data-testid={`finish-early-${tipo}`}
        onClick={() =>
          start(async () => {
            await finishReviewAction(sessionId, false);
            toast.show({ message: "Tu revisión quedó guardada." });
            router.refresh();
          })
        }
      >
        <Check size={13} aria-hidden /> Dar por terminada
      </button>
    </div>
  );
}

/* ── Cascarón del asistente: un paso a la vez ────────────────────── */

export function ReviewShell({
  sessionId,
  tipo,
  paso,
  total,
  titulos,
  intro,
  children,
}: {
  sessionId: string;
  tipo: "diaria" | "semanal";
  paso: number;
  total: number;
  titulos: string[];
  intro?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const toast = useToast();
  const esUltimo = paso >= total;

  function irA(n: number) {
    start(async () => {
      await goToReviewStepAction(sessionId, n);
      router.push(`/revisiones/${tipo}?paso=${n}`);
    });
  }

  return (
    <div className="max-w-2xl" data-testid={`review-${tipo}`}>
      {/* progreso discreto */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex gap-1" role="progressbar" aria-valuenow={paso} aria-valuemin={1} aria-valuemax={total} aria-label="Progreso de la revisión">
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={`h-1.5 w-7 rounded-full ${i < paso ? "bg-sage-deep" : "bg-sand"}`} />
          ))}
        </div>
        <span className="text-xs text-stone tabular-nums" data-testid="review-step-label">
          Paso {paso} de {total} · {titulos[paso - 1]}
        </span>
        <Link href="/" className="ml-auto text-xs text-stone hover:text-forest underline underline-offset-4" data-testid="review-exit">
          <DoorOpen size={12} className="inline mr-0.5" aria-hidden /> Salir y continuar después
        </Link>
      </div>

      <h1 className="text-2xl text-forest-deep mb-1">{titulos[paso - 1]}</h1>
      {intro && <p className="text-sm text-stone mb-4">{intro}</p>}

      <div className="flex flex-col gap-3 mb-6">{children}</div>

      <div className="flex items-center gap-2 border-t border-beige pt-4">
        {paso > 1 && (
          <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => irA(paso - 1)} data-testid="review-prev">
            <ArrowLeft size={14} aria-hidden /> Anterior
          </button>
        )}
        {esUltimo ? (
          <button
            type="button"
            className="btn btn-primary ml-auto"
            disabled={pending}
            data-testid="review-finish"
            onClick={() =>
              start(async () => {
                await finishReviewAction(sessionId, true);
                toast.show({ message: tipo === "semanal" ? "Semana preparada ✓ Tu revisión quedó guardada." : "Día cerrado ✓ Tu revisión quedó guardada." });
                router.push("/revisiones");
              })
            }
          >
            {tipo === "semanal" ? "Semana preparada" : "Cerrar revisión"} <Check size={14} aria-hidden />
          </button>
        ) : (
          <button type="button" className="btn btn-primary ml-auto" disabled={pending} onClick={() => irA(paso + 1)} data-testid="review-next">
            Siguiente <ArrowRight size={14} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Filas compactas con acciones (máx. 5 por tanda) ─────────────── */

function RowShell({ children, hidden }: { children: ReactNode; hidden: boolean }) {
  if (hidden) return null;
  return <div className="card !rounded-xl p-3">{children}</div>;
}

/** Tarea dentro de la revisión: TaskLine (abrir/completar) + acciones rápidas. */
export function ReviewTaskRow({
  card,
  reason,
  sessionId,
  showArchive = false,
}: {
  card: CardRow;
  reason: string;
  sessionId: string;
  showArchive?: boolean;
}) {
  const [hidden, setHidden] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();

  const manana = () => {
    const t = new Date(Date.now() + 86_400_000).toLocaleDateString("en-CA");
    return t;
  };
  const proxSemana = () => new Date(Date.now() + 7 * 86_400_000).toLocaleDateString("en-CA");

  function accion(fn: () => Promise<unknown>, mensaje: string) {
    start(async () => {
      try {
        await fn();
        await bumpReviewProcessedAction(sessionId);
        toast.show({ message: mensaje });
        setHidden(true);
      } catch {
        toast.show({ tone: "error", message: "No se pudo aplicar el cambio." });
      }
    });
  }

  return (
    <RowShell hidden={hidden}>
      <p className="text-xs text-stone-soft mb-1">{reason}</p>
      <TaskLine card={card} />
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        <button type="button" className="btn btn-ghost !py-1 !px-2 text-xs" disabled={pending}
          onClick={() => accion(() => rescheduleCardAction(card.id, manana()), "Reprogramada para mañana ✓")} data-testid="rt-manana">
          <CalendarClock size={12} aria-hidden /> Mañana
        </button>
        <button type="button" className="btn btn-ghost !py-1 !px-2 text-xs" disabled={pending}
          onClick={() => accion(() => rescheduleCardAction(card.id, proxSemana()), "Reprogramada a la próxima semana ✓")} data-testid="rt-semana">
          <CalendarClock size={12} aria-hidden /> +7 días
        </button>
        {card.dueDate && (
          <button type="button" className="btn btn-ghost !py-1 !px-2 text-xs" disabled={pending}
            onClick={() => accion(() => rescheduleCardAction(card.id, null), "Sin fecha — ya no vencerá ✓")} data-testid="rt-sinfecha">
            Quitar fecha
          </button>
        )}
        {card.projectId && (
          <button type="button" className="btn btn-ghost !py-1 !px-2 text-xs" disabled={pending}
            onClick={() => accion(() => moveCardToKindAction(card.id, "despues"), "Movida a «Después» ✓")} data-testid="rt-despues">
            <Moon size={12} aria-hidden /> Después
          </button>
        )}
        {showArchive && (
          <button type="button" className="btn btn-ghost !py-1 !px-2 text-xs" disabled={pending}
            onClick={() => accion(() => archiveCardAction(card.id, true), "Archivada ✓")} data-testid="rt-archivar">
            <Archive size={12} aria-hidden /> Archivar
          </button>
        )}
        <button type="button" className="btn btn-ghost !py-1 !px-2 text-xs text-stone" onClick={() => setHidden(true)} data-testid="rt-mantener">
          Mantener así
        </button>
      </div>
    </RowShell>
  );
}

/** Proyecto dentro de la revisión semanal. */
export function ReviewProjectRow({
  projectId,
  title,
  issues,
  sessionId,
}: {
  projectId: string;
  title: string;
  issues: string[];
  sessionId: string;
}) {
  const [hidden, setHidden] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();

  function accion(fn: () => Promise<unknown>, mensaje: string) {
    start(async () => {
      try {
        await fn();
        await bumpReviewProcessedAction(sessionId);
        toast.show({ message: mensaje });
        setHidden(true);
      } catch {
        toast.show({ tone: "error", message: "No se pudo aplicar el cambio." });
      }
    });
  }

  return (
    <RowShell hidden={hidden}>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-stone mt-0.5">{issues.join(" · ")}</p>
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        <Link href={`/proyectos/${projectId}?retomar=1`} className="btn btn-secondary !py-1 !px-2 text-xs" data-testid="rp-retomar">
          <RotateCcw size={12} aria-hidden /> Retomar
        </Link>
        <Link href={`/proyectos/${projectId}`} className="btn btn-ghost !py-1 !px-2 text-xs" data-testid="rp-definir">
          <ArrowRight size={12} aria-hidden /> Definir siguiente acción
        </Link>
        <button type="button" className="btn btn-ghost !py-1 !px-2 text-xs" disabled={pending}
          onClick={() => accion(() => setProjectStatusAction(projectId, "pausado"), "Proyecto pausado — descansa tranquilo ✓")} data-testid="rp-pausar">
          <Pause size={12} aria-hidden /> Pausar
        </button>
        <button type="button" className="btn btn-ghost !py-1 !px-2 text-xs" disabled={pending}
          onClick={() => accion(() => archiveProjectAction(projectId, true), "Proyecto archivado ✓")} data-testid="rp-archivar">
          <Archive size={12} aria-hidden /> Archivar
        </button>
        <button type="button" className="btn btn-ghost !py-1 !px-2 text-xs text-stone" onClick={() => setHidden(true)} data-testid="rp-mantener">
          Mantener activo
        </button>
      </div>
    </RowShell>
  );
}

/** Idea de la Incubadora. Nada se convierte sin decisión explícita. */
export function ReviewIdeaRow({ id, title, sessionId }: { id: string; title: string; sessionId: string }) {
  const [hidden, setHidden] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();

  function accion(fn: () => Promise<unknown>, mensaje: string) {
    start(async () => {
      try {
        await fn();
        await bumpReviewProcessedAction(sessionId);
        toast.show({ message: mensaje });
        setHidden(true);
      } catch {
        toast.show({ tone: "error", message: "No se pudo aplicar el cambio." });
      }
    });
  }

  return (
    <RowShell hidden={hidden}>
      <p className="text-sm font-medium flex items-center gap-1.5"><Lightbulb size={13} className="text-olive" aria-hidden /> {title}</p>
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        <button type="button" className="btn btn-secondary !py-1 !px-2 text-xs" disabled={pending}
          onClick={() => accion(() => graduateIdeaAction(id, "proyecto"), "Convertida en proyecto ✓")} data-testid="ri-proyecto">
          <SquareKanban size={12} aria-hidden /> A proyecto
        </button>
        <button type="button" className="btn btn-secondary !py-1 !px-2 text-xs" disabled={pending}
          onClick={() => accion(() => graduateIdeaAction(id, "learnfast"), "Convertida en Learn Fast ✓")} data-testid="ri-learn">
          <Rocket size={12} aria-hidden /> A Learn Fast
        </button>
        <button type="button" className="btn btn-ghost !py-1 !px-2 text-xs" disabled={pending}
          onClick={() => accion(() => touchIdeaAction(id), "Sigue incubando, revisada hoy ✓")} data-testid="ri-mantener">
          Mantener incubando
        </button>
        <button type="button" className="btn btn-ghost !py-1 !px-2 text-xs" disabled={pending}
          onClick={() => accion(() => updateIdeaStatusAction(id, "algun-dia"), "Guardada en «Algún día» ✓")} data-testid="ri-algundia">
          Algún día
        </button>
        <button type="button" className="btn btn-ghost !py-1 !px-2 text-xs" disabled={pending}
          onClick={() => accion(() => updateIdeaStatusAction(id, "archivada"), "Idea archivada ✓")} data-testid="ri-archivar">
          <Archive size={12} aria-hidden /> Archivar
        </button>
        {confirmDelete ? (
          <span className="flex items-center gap-1 text-xs">
            ¿Eliminar?
            <button type="button" className="btn btn-danger !py-1 !px-2 text-xs" disabled={pending}
              onClick={() => accion(() => deleteIdeaAction(id), "Idea eliminada.")} data-testid="ri-eliminar-confirm">Sí</button>
            <button type="button" className="btn btn-ghost !py-1 !px-2 text-xs" onClick={() => setConfirmDelete(false)}>No</button>
          </span>
        ) : (
          <button type="button" className="btn btn-danger !py-1 !px-2 text-xs" onClick={() => setConfirmDelete(true)} data-testid="ri-eliminar">
            <Trash2 size={12} aria-hidden />
          </button>
        )}
      </div>
    </RowShell>
  );
}

/** Tema Learn Fast. */
export function ReviewLearnRow({
  id, title, status, note, sessionId,
}: { id: string; title: string; status: string; note: string; sessionId: string }) {
  const [hidden, setHidden] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();

  function accion(fn: () => Promise<unknown>, mensaje: string) {
    start(async () => {
      try {
        await fn();
        await bumpReviewProcessedAction(sessionId);
        toast.show({ message: mensaje });
        setHidden(true);
      } catch {
        toast.show({ tone: "error", message: "No se pudo aplicar el cambio." });
      }
    });
  }

  return (
    <RowShell hidden={hidden}>
      <p className="text-sm font-medium flex items-center gap-1.5"><Rocket size={13} className="text-olive" aria-hidden /> {title}</p>
      <p className="text-xs text-stone mt-0.5">{note}</p>
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        <Link href={`/explorar/learn-fast/${id}`} className="btn btn-secondary !py-1 !px-2 text-xs" data-testid="rl-abrir">
          <ArrowRight size={12} aria-hidden /> {status === "pausado" ? "Continuar" : "Definir siguiente paso"}
        </Link>
        {status === "activo" ? (
          <button type="button" className="btn btn-ghost !py-1 !px-2 text-xs" disabled={pending}
            onClick={() => accion(() => setLearningStatusAction(id, "pausado"), "Tema pausado ✓")} data-testid="rl-pausar">
            <Pause size={12} aria-hidden /> Pausar
          </button>
        ) : (
          <button type="button" className="btn btn-ghost !py-1 !px-2 text-xs" disabled={pending}
            onClick={() => accion(() => setLearningStatusAction(id, "activo"), "Tema reactivado ✓")} data-testid="rl-reactivar">
            <Sun size={12} aria-hidden /> Reactivar
          </button>
        )}
        <button type="button" className="btn btn-ghost !py-1 !px-2 text-xs" disabled={pending}
          onClick={() => accion(() => setLearningStatusAction(id, "terminado"), "Tema completado ✓")} data-testid="rl-completar">
          <Check size={12} aria-hidden /> Completar
        </button>
        <button type="button" className="btn btn-ghost !py-1 !px-2 text-xs" disabled={pending}
          onClick={() => accion(() => setLearningStatusAction(id, "archivado"), "Tema archivado ✓")} data-testid="rl-archivar">
          <Archive size={12} aria-hidden /> Archivar
        </button>
        <button type="button" className="btn btn-ghost !py-1 !px-2 text-xs text-stone" onClick={() => setHidden(true)}>
          Mantener
        </button>
      </div>
    </RowShell>
  );
}

/** Recurso guardado pendiente de consultar. */
export function ReviewResourceRow({
  id, title, url, status, sessionId,
}: { id: string; title: string; url: string; status: string; sessionId: string }) {
  const [hidden, setHidden] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();

  function accion(fn: () => Promise<unknown>, mensaje: string) {
    start(async () => {
      try {
        await fn();
        await bumpReviewProcessedAction(sessionId);
        toast.show({ message: mensaje });
        setHidden(true);
      } catch {
        toast.show({ tone: "error", message: "No se pudo aplicar el cambio." });
      }
    });
  }

  return (
    <RowShell hidden={hidden}>
      <p className="text-sm font-medium">
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-forest">{title}</a>
        ) : (
          title
        )}
        <span className="chip ml-2 !text-[11px]">{status === "en-proceso" ? "En progreso" : "Pendiente"}</span>
      </p>
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        <button type="button" className="btn btn-secondary !py-1 !px-2 text-xs" disabled={pending}
          onClick={() => accion(() => updateResourceStatusAction(id, "revisado"), "Marcado como revisado ✓")} data-testid="rr-revisado">
          <Check size={12} aria-hidden /> Revisado
        </button>
        <Link href={`/biblioteca/recursos`} className="btn btn-ghost !py-1 !px-2 text-xs" data-testid="rr-vincular">
          <FolderInput size={12} aria-hidden /> Vincular
        </Link>
        <button type="button" className="btn btn-ghost !py-1 !px-2 text-xs text-stone" onClick={() => setHidden(true)} data-testid="rr-mantener">
          Mantener pendiente
        </button>
        {confirmDelete ? (
          <span className="flex items-center gap-1 text-xs">
            ¿Eliminar?
            <button type="button" className="btn btn-danger !py-1 !px-2 text-xs" disabled={pending}
              onClick={() => accion(() => deleteResourceAction(id), "Recurso eliminado.")} data-testid="rr-eliminar-confirm">Sí</button>
            <button type="button" className="btn btn-ghost !py-1 !px-2 text-xs" onClick={() => setConfirmDelete(false)}>No</button>
          </span>
        ) : (
          <button type="button" className="btn btn-danger !py-1 !px-2 text-xs" onClick={() => setConfirmDelete(true)} data-testid="rr-eliminar">
            <Trash2 size={12} aria-hidden />
          </button>
        )}
      </div>
    </RowShell>
  );
}
